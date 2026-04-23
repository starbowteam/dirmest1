/*****************************************************
 * .DRM — СЕРЕБРЯНЫЙ МЕССЕНДЖЕР
 * Полная логика: регистрация, вход, чаты, избранное,
 * стена, поиск по тегу, отправка файлов, сворачивание
 * боковой панели, анимации, localStorage.
 *****************************************************/

// ========== ХРАНИЛИЩЕ ==========
const DB = {
  USERS: 'drm_users',
  CURRENT: 'drm_current',
  MESSAGES: 'drm_msgs',
  CHATS: 'drm_chats',
  WALL: 'drm_wall',
  FAVORITES: 'drm_favorites'
};

function initDB() {
  if (!localStorage.getItem(DB.USERS)) localStorage.setItem(DB.USERS, '[]');
  if (!localStorage.getItem(DB.MESSAGES)) localStorage.setItem(DB.MESSAGES, '{}');
  if (!localStorage.getItem(DB.CHATS)) localStorage.setItem(DB.CHATS, '{}');
  if (!localStorage.getItem(DB.WALL)) localStorage.setItem(DB.WALL, '[]');
  if (!localStorage.getItem(DB.FAVORITES)) localStorage.setItem(DB.FAVORITES, '[]');
}
initDB();

const getUsers = () => JSON.parse(localStorage.getItem(DB.USERS));
const saveUser = user => {
  const users = getUsers();
  users.push(user);
  localStorage.setItem(DB.USERS, JSON.stringify(users));
};
const findUserByTag = tag => getUsers().find(u => u.tag.toLowerCase() === tag.toLowerCase());
const getCurrentUser = () => JSON.parse(localStorage.getItem(DB.CURRENT));
const setCurrentUser = user => localStorage.setItem(DB.CURRENT, JSON.stringify(user));
const logout = () => localStorage.removeItem(DB.CURRENT);

const getChats = () => JSON.parse(localStorage.getItem(DB.CHATS));
const saveChat = chat => {
  const chats = getChats();
  chats[chat.id] = chat;
  localStorage.setItem(DB.CHATS, JSON.stringify(chats));
};
const getChat = id => getChats()[id];
const getUserChatIds = userId => {
  const all = getChats();
  return Object.keys(all).filter(id => all[id].members.includes(userId));
};

const getMessages = chatId => {
  const all = JSON.parse(localStorage.getItem(DB.MESSAGES));
  return all[chatId] || [];
};
const saveMessage = (chatId, msg) => {
  const all = JSON.parse(localStorage.getItem(DB.MESSAGES));
  if (!all[chatId]) all[chatId] = [];
  all[chatId].push(msg);
  localStorage.setItem(DB.MESSAGES, JSON.stringify(all));
};

const getWallPosts = () => JSON.parse(localStorage.getItem(DB.WALL));
const addWallPost = post => {
  const posts = getWallPosts();
  posts.unshift(post);
  localStorage.setItem(DB.WALL, JSON.stringify(posts));
};

const getFavorites = () => JSON.parse(localStorage.getItem(DB.FAVORITES));
const addFavorite = chatId => {
  const favs = getFavorites();
  if (!favs.includes(chatId)) {
    favs.push(chatId);
    localStorage.setItem(DB.FAVORITES, JSON.stringify(favs));
  }
};
const removeFavorite = chatId => {
  const favs = getFavorites().filter(id => id !== chatId);
  localStorage.setItem(DB.FAVORITES, JSON.stringify(favs));
};
const isFavorite = chatId => getFavorites().includes(chatId);

// ========== УТИЛИТЫ ==========
const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
const formatTime = ts => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let currentUser = null;
let activeChatId = null;
let activeTab = 'chats';

// ========== UI ==========
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  const el = document.getElementById(id + '-screen');
  if (el) el.style.display = (id === 'auth' ? 'flex' : 'block');
}

function updateSidebar() {
  document.getElementById('sidebar-username').textContent = currentUser?.name || 'Гость';
  document.getElementById('user-card').querySelector('.avatar i').className = 'fas fa-user';
}

function renderList(containerId, items, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (!items.length) {
    container.innerHTML = '<div style="padding:1rem;color:var(--text-secondary);text-align:center;">Пусто</div>';
    return;
  }
  items.forEach(item => {
    if (type === 'chat') {
      const chat = item;
      const otherId = chat.members.find(id => id !== currentUser.id);
      const otherUser = otherId ? getUsers().find(u => u.id === otherId) : { name: 'Группа', avatar: 'G' };
      const lastMsg = getMessages(chat.id).slice(-1)[0];
      const el = document.createElement('данные');
      el.className = 'chat-item' + (activeChatId === chat.id ? ' active-chat' : '') + (isFavorite(chat.id) ? ' favorite' : '');
      el.innerHTML = `
        <div class="avatar"><i class="fas fa-user"></i></div>
        <div class="chat-info">
          <div class="chat-name">${otherUser.name || 'Безымянный'}</div>
          <div class="last-message">${lastMsg ? lastMsg.text : 'Нет сообщений'}</div>
        </div>
        <i class="fav-star fas fa-star"></i>
      `;
      el.addEventListener('click', () => openChat(chat.id));
      container.appendChild(el);
    } else if (type === 'user') {
      const user = item;
      const el = document.createElement('данные');
      el.className = 'user-item';
      el.innerHTML = `
        <div class="avatar"><i class="fas fa-user"></i></div>
        <div><strong>${user.name}</strong><br><small>@${user.tag}</small></div>
      `;
      el.addEventListener('click', () => startPrivateChat(user));
      container.appendChild(el);
    }
  });
}

function renderMessages(chatId) {
  const container = document.getElementById('messages-container');
  const messages = getMessages(chatId);
  if (!messages.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><p>Нет сообщений</p></div>';
    return;
  }
  container.innerHTML = messages.map(m => {
    const isOwn = m.senderId === currentUser.id;
    return `
      <div class="message-row ${isOwn ? 'own' : ''}">
        <div class="message-avatar"><i class="fas fa-user"></i></div>
        <div class="message-bubble">
          ${m.text}
          ${m.file ? `<div class="file-attachment"><i class="fas fa-file"></i> ${m.file.name}</div>` : ''}
          <div class="message-meta">${formatTime(m.timestamp)}</div>
        </div>
      </div>
    `;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function renderWall() {
  const container = document.getElementById('messages-container');
  const posts = getWallPosts();
  if (!posts.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-newspaper"></i><p>Стена пуста</p></div>';
    return;
  }
  container.innerHTML = posts.map(p => `
    <div class="wall-post">
      <div class="post-header">
        <div class="avatar"><i class="fas fa-user"></i></div>
        <div>
          <div class="post-author">${p.authorName}</div>
          <div class="post-time">${formatTime(p.timestamp)}</div>
        </div>
      </div>
      <div class="post-content">${p.content}</div>
      <div class="post-actions">
        <span><i class="far fa-heart"></i> ${p.likes}</span>
        <span><i class="far fa-comment"></i></span>
      </div>
    </div>
  `).join('');
}

function openChat(chatId) {
  activeChatId = chatId;
  const chat = getChat(chatId);
  if (!chat) return;
  const otherId = chat.members.find(id => id !== currentUser.id);
  const otherUser = otherId ? getUsers().find(u => u.id === otherId) : { name: 'Группа', avatar: 'G' };
  document.getElementById('chat-title').textContent = otherUser?.name || 'Группа';
  document.getElementById('chat-subtitle').textContent = 'онлайн';
  document.getElementById('message-input-area').style.display = 'flex';
  document.getElementById('toggle-favorite').innerHTML = isFavorite(chatId) ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
  renderMessages(chatId);
  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active-chat'));
  const activeEl = [...document.querySelectorAll('.chat-item')].find(el => el.dataset.chatId === chatId);
  if (activeEl) activeEl.classList.add('active-chat');
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('mobile-visible');
  }
}

function startPrivateChat(targetUser) {
  const existingChatId = Object.keys(getChats()).find(id => {
    const chat = getChat(id);
    return chat.members.includes(currentUser.id) && chat.members.includes(targetUser.id) && !chat.isGroup;
  });
  if (existingChatId) {
    openChat(existingChatId);
    return;
  }
  const newChatId = genId();
  const chat = {
    id: newChatId,
    members: [currentUser.id, targetUser.id],
    isGroup: false,
    createdAt: Date.now()
  };
  saveChat(chat);
  openChat(newChatId);
}

function sendMessage() {
  if (!activeChatId) return;
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text && !pendingFile) return;
  
  const msg = {
    id: genId(),
    chatId: activeChatId,
    senderId: currentUser.id,
    text: text || '',
    file: pendingFile || null,
    timestamp: Date.now()
  };
  saveMessage(activeChatId, msg);
  pendingFile = null;
  input.value = '';
  renderMessages(activeChatId);
  document.getElementById('file-upload-btn').classList.remove('has-file');
}

let pendingFile = null;

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  pendingFile = { name: file.name, type: file.type, size: file.size };
  document.getElementById('file-upload-btn').classList.add('has-file');
  const input = document.getElementById('message-input');
  input.placeholder = `Файл: ${file.name}`;
}

// ========== АВТОРИЗАЦИЯ ==========
function renderAuthForms() {
  const tabs = document.querySelectorAll('.auth-tab');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('active'));
    t.classList.add('active');
    t.dataset.tab === 'login' ? renderLoginForm() : renderRegisterForm();
  }));
  renderLoginForm();
}

function renderLoginForm() {
  const container = document.getElementById('auth-forms');
  container.innerHTML = `
    <form id="login-form" class="form">
      <div class="input-group">
        <label>Тег</label>
        <input type="text" id="login-tag" placeholder="ваш_тег" required>
      </div>
      <div class="input-group">
        <label>Пароль</label>
        <input type="password" id="login-password" placeholder="••••••" required>
      </div>
      <div class="error-msg" id="login-error"></div>
      <button type="submit" class="btn-primary">Войти</button>
    </form>
  `;
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tag = document.getElementById('login-tag').value.trim();
    const pass = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    const user = findUserByTag(tag);
    if (!user || user.password !== pass) {
      err.textContent = 'Неверный тег или пароль';
      return;
    }
    currentUser = { id: user.id, name: user.name, tag: user.tag, avatar: user.avatar };
    setCurrentUser(currentUser);
    goToMain();
  });
}

function renderRegisterForm() {
  const container = document.getElementById('auth-forms');
  container.innerHTML = `
    <form id="register-form" class="form">
      <div class="input-group">
        <label>Имя</label>
        <input type="text" id="reg-name" placeholder="Виктор" required>
      </div>
      <div class="input-group">
        <label>Тег</label>
        <input type="text" id="reg-tag" placeholder="viktor_dev" required>
      </div>
      <div class="input-group">
        <label>Пароль</label>
        <input type="password" id="reg-password" placeholder="••••••" required>
      </div>
      <div class="input-group">
        <label>Повторите пароль</label>
        <input type="password" id="reg-password2" placeholder="••••••" required>
      </div>
      <div class="error-msg" id="reg-error"></div>
      <button type="submit" class="btn-primary">Зарегистрироваться</button>
    </form>
  `;
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const tag = document.getElementById('reg-tag').value.trim();
    const pass = document.getElementById('reg-password').value;
    const pass2 = document.getElementById('reg-password2').value;
    const err = document.getElementById('reg-error');
    if (!name || !tag || !pass) {
      err.textContent = 'Заполните все поля';
      return;
    }
    if (pass !== pass2) {
      err.textContent = 'Пароли не совпадают';
      return;
    }
    if (pass.length < 4) {
      err.textContent = 'Пароль должен быть длиннее 4 символов';
      return;
    }
    if (findUserByTag(tag)) {
      err.textContent = 'Тег уже занят';
      return;
    }
    const newUser = {
      id: genId(),
      name,
      tag,
      password: pass,
      avatar: 'default'
    };
    saveUser(newUser);
    currentUser = { id: newUser.id, name, tag, avatar: 'default' };
    setCurrentUser(currentUser);
    goToMain();
  });
}

function goToMain() {
  document.getElementById('loading-screen').style.display = 'none';
  showScreen('main');
  updateSidebar();
  loadChatList();
  initMainListeners();
}

// ========== ОСНОВНАЯ ЛОГИКА ==========
function loadChatList() {
  const container = document.getElementById('list-container');
  container.innerHTML = '';
  if (activeTab === 'chats') {
    const chatIds = getUserChatIds(currentUser.id);
    const chats = chatIds.map(id => getChat(id)).filter(c => c);
    renderList('list-container', chats, 'chat');
  } else if (activeTab === 'favorites') {
    const favIds = getFavorites();
    const favChats = favIds.map(id => getChat(id)).filter(c => c);
    renderList('list-container', favChats, 'chat');
  } else if (activeTab === 'users') {
    const users = getUsers().filter(u => u.id !== currentUser.id);
    renderList('list-container', users, 'user');
  } else if (activeTab === 'wall') {
    renderWall();
    document.getElementById('message-input-area').style.display = 'flex';
    document.getElementById('message-input').placeholder = 'Что нового?';
    document.getElementById('chat-title').textContent = 'Общая стена';
    document.getElementById('chat-subtitle').textContent = 'Последние записи';
    activeChatId = null;
  }
}

function initMainListeners() {
  // Сворачивание сайдбара
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
  });
  // Мобильный бэк
  document.getElementById('mobile-back-btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('mobile-visible');
  });
  // Открытие сайдбара на мобилке по свайпу/кнопке (добавим на аватар)
  document.getElementById('user-card').addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.toggle('mobile-visible');
    }
  });
  // Вкладки сайдбара
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      loadChatList();
    });
  });
  // Поиск по тегу
  document.getElementById('search-input').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.chat-item, .user-item').forEach(el => {
      const text = el.textContent.toLowerCase();
      el.style.display = text.includes(q) ? '' : 'none';
    });
  });
  // Отправка сообщения
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  // Файлы
  document.getElementById('file-upload-btn').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });
  document.getElementById('file-input').addEventListener('change', handleFileSelect);
  // Избранное
  document.getElementById('toggle-favorite').addEventListener('click', () => {
    if (!activeChatId) return;
    if (isFavorite(activeChatId)) {
      removeFavorite(activeChatId);
    } else {
      addFavorite(activeChatId);
    }
    document.getElementById('toggle-favorite').innerHTML = isFavorite(activeChatId) ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
    loadChatList();
  });
  // Выход
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    logout();
    location.reload();
  });
  // Добавим кнопку выхода в сайдбар, если её нет – создадим
  if (!document.getElementById('logout-btn')) {
    const btn = document.createElement('button');
    btn.id = 'logout-btn';
    btn.className = 'icon-btn';
    btn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
    btn.title = 'Выйти';
    document.querySelector('.sidebar-header').appendChild(btn);
    btn.addEventListener('click', () => {
      logout();
      location.reload();
    });
  }
  // Отправка на стене
  document.getElementById('send-btn').addEventListener('click', () => {
    if (activeChatId === null && activeTab === 'wall') {
      const input = document.getElementById('message-input');
      const text = input.value.trim();
      if (!text) return;
      addWallPost({
        id: genId(),
        authorName: currentUser.name,
        content: text,
        timestamp: Date.now(),
        likes: 0
      });
      input.value = '';
      renderWall();
    }
  });
}

// ========== СТАРТ ==========
window.addEventListener('DOMContentLoaded', () => {
  const saved = getCurrentUser();
  if (saved) {
    currentUser = saved;
    document.getElementById('loading-screen').style.display = 'none';
    showScreen('main');
    updateSidebar();
    loadChatList();
    initMainListeners();
  } else {
    document.getElementById('loading-screen').style.display = 'none';
    showScreen('auth');
    renderAuthForms();
  }
});
