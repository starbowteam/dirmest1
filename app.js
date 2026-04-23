/*****************************************************
 * .DRM — СЕРЕБРЯНЫЙ МЕССЕНДЖЕР (ТГ-СТИЛЬ)
 * Избранное, стена, файлы, профиль, PWA
 *****************************************************/
const DB = {
  USERS: 'drm_users',
  CURRENT: 'drm_current',
  MESSAGES: 'drm_msgs',
  CHATS: 'drm_chats',
  WALL: 'drm_wall',
  PROFILES: 'drm_profiles'
};

function initDB() {
  for (let k of Object.values(DB)) {
    if (!localStorage.getItem(k)) {
      localStorage.setItem(k, (k === DB.MESSAGES || k === DB.CHATS || k === DB.PROFILES) ? '{}' : '[]');
    }
  }
}
initDB();

// ========== УТИЛИТЫ ==========
const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2,5);
const formatTime = ts => new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

// ========== ДАННЫЕ ==========
const getUsers = () => JSON.parse(localStorage.getItem(DB.USERS));
const saveUser = u => { const users = getUsers(); users.push(u); localStorage.setItem(DB.USERS, JSON.stringify(users)); };
const findUserByTag = tag => getUsers().find(u => u.tag.toLowerCase() === tag.toLowerCase());
const getCurrentUser = () => JSON.parse(localStorage.getItem(DB.CURRENT));
const setCurrentUser = u => localStorage.setItem(DB.CURRENT, JSON.stringify(u));
const logout = () => localStorage.removeItem(DB.CURRENT);

const getChats = () => JSON.parse(localStorage.getItem(DB.CHATS));
const saveChat = chat => { const chats = getChats(); chats[chat.id] = chat; localStorage.setItem(DB.CHATS, JSON.stringify(chats)); };
const getChat = id => getChats()[id];
const getUserChatIds = uid => Object.keys(getChats()).filter(id => getChat(id).members.includes(uid));

const getMessages = chatId => JSON.parse(localStorage.getItem(DB.MESSAGES))[chatId] || [];
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

const getProfile = uid => JSON.parse(localStorage.getItem(DB.PROFILES))[uid] || { bio: '', banner: '' };
const saveProfile = (uid, data) => {
  const profiles = JSON.parse(localStorage.getItem(DB.PROFILES));
  profiles[uid] = { ...getProfile(uid), ...data };
  localStorage.setItem(DB.PROFILES, JSON.stringify(profiles));
};

// ========== ГЛОБАЛЬНЫЕ ==========
let currentUser = null, activeChatId = null, activeTab = 'chats', pendingFile = null;

// ========== UI ==========
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  document.getElementById(id + '-screen').style.display = (id === 'auth' ? 'flex' : 'block');
}

function updateSidebar() {
  document.getElementById('sidebar-username').textContent = currentUser?.name || 'Гость';
  const avatarEl = document.getElementById('sidebar-avatar');
  avatarEl.innerHTML = currentUser?.avatar ? `<img src="${currentUser.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : '<i class="fas fa-user"></i>';
}

function renderChatList() {
  const container = document.getElementById('list-container');
  container.innerHTML = '';
  if (activeTab === 'wall') {
    renderWall();
    return;
  }
  if (activeTab === 'users') {
    const users = getUsers().filter(u => u.id !== currentUser.id);
    users.forEach(u => {
      const el = document.createElement('div'); el.className = 'user-item';
      el.innerHTML = `<div class="avatar"><i class="fas fa-user"></i></div><div><strong>${u.name}</strong><br><small>@${u.tag}</small></div>`;
      el.addEventListener('click', () => startPrivateChat(u));
      container.appendChild(el);
    });
    return;
  }
  let chatIds;
  if (activeTab === 'favorites') {
    chatIds = getUserChatIds(currentUser.id).filter(id => getChat(id).favorite);
  } else {
    chatIds = getUserChatIds(currentUser.id).filter(id => !getChat(id).isWall);
  }
  chatIds.forEach(id => {
    const chat = getChat(id);
    const otherId = chat.members.find(m => m !== currentUser.id);
    const other = otherId ? getUsers().find(u => u.id === otherId) : { name: 'Избранное', avatar: null };
    const lastMsg = getMessages(id).slice(-1)[0];
    const el = document.createElement('div'); el.className = 'chat-item' + (activeChatId === id ? ' active-chat' : '');
    el.innerHTML = `
      <div class="avatar">${other.avatar ? `<img src="${other.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : '<i class="fas fa-user"></i>'}</div>
      <div class="chat-info"><div class="chat-name">${other.name || 'Группа'}</div><div class="last-message">${lastMsg ? lastMsg.text : 'Нет сообщений'}</div></div>
      ${chat.favorite ? '<i class="fas fa-star fav-star"></i>' : ''}
    `;
    el.addEventListener('click', () => openChat(id));
    container.appendChild(el);
  });
}

function renderWall() {
  document.getElementById('chat-title').textContent = 'Общая стена';
  document.getElementById('chat-subtitle').textContent = 'Последние записи';
  document.getElementById('message-input-area').style.display = 'flex';
  const posts = getWallPosts();
  const container = document.getElementById('messages-container');
  container.innerHTML = posts.length ? posts.map(p => `
    <div class="wall-post">
      <div class="post-header"><div class="avatar"><i class="fas fa-user"></i></div><div><div class="post-author">${p.authorName}</div><div class="post-time">${formatTime(p.timestamp)}</div></div></div>
      <div>${p.content}</div>
      <div class="post-actions"><span><i class="far fa-heart"></i> ${p.likes||0}</span></div>
    </div>
  `).join('') : '<div class="empty-state"><i class="fas fa-newspaper"></i><p>Пусто</p></div>';
}

function openChat(id) {
  activeChatId = id;
  const chat = getChat(id);
  if (!chat) return;
  const otherId = chat.members.find(m => m !== currentUser.id);
  const other = otherId ? getUsers().find(u => u.id === otherId) : { name: 'Избранное', avatar: null };
  document.getElementById('chat-title').textContent = other?.name || 'Чат';
  document.getElementById('chat-subtitle').textContent = 'онлайн';
  document.getElementById('message-input-area').style.display = 'flex';
  document.getElementById('toggle-favorite').innerHTML = chat.favorite ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
  renderMessages(id);
  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active-chat'));
  const activeEl = [...document.querySelectorAll('.chat-item')].find(el => el.dataset.chatId === id);
  if (activeEl) activeEl.classList.add('active-chat');
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('mobile-visible');
}

function renderMessages(chatId) {
  const msgs = getMessages(chatId);
  const container = document.getElementById('messages-container');
  container.innerHTML = msgs.length ? msgs.map(m => {
    const own = m.senderId === currentUser.id;
    return `<div class="message-row ${own ? 'own' : ''}">
      <div class="message-avatar"><i class="fas fa-user"></i></div>
      <div class="message-bubble">
        ${m.text} ${m.file ? `<div class="file-attachment"><i class="fas fa-file"></i> ${m.file.name}</div>` : ''}
        <div class="message-meta">${formatTime(m.timestamp)}</div>
      </div>
    </div>`;
  }).join('') : '<div class="empty-state"><i class="fas fa-comments"></i><p>Нет сообщений</p></div>';
  container.scrollTop = container.scrollHeight;
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
}

function startPrivateChat(targetUser) {
  const existingId = Object.keys(getChats()).find(id => {
    const c = getChat(id);
    return c.members.includes(currentUser.id) && c.members.includes(targetUser.id) && !c.isGroup;
  });
  if (existingId) { openChat(existingId); return; }
  const newId = genId();
  saveChat({ id: newId, members: [currentUser.id, targetUser.id], isGroup: false, favorite: false });
  openChat(newId);
}

function createFavoriteChat() {
  if (!currentUser) return;
  const favId = 'fav_' + currentUser.id;
  if (!getChat(favId)) {
    saveChat({ id: favId, members: [currentUser.id], isGroup: false, favorite: true, name: 'Избранное' });
  }
  openChat(favId);
}

// ========== АВТОРИЗАЦИЯ ==========
function renderAuthForms() {
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
      t.classList.add('active');
      t.dataset.tab === 'login' ? renderLogin() : renderRegister();
    });
  });
  renderLogin();
}

function renderLogin() {
  document.getElementById('auth-forms').innerHTML = `
    <form id="login-form" class="form">
      <div class="input-group"><label>Тег</label><input type="text" id="login-tag" required></div>
      <div class="input-group"><label>Пароль</label><input type="password" id="login-password" required></div>
      <div class="error-msg" id="login-error"></div>
      <button type="submit" class="btn-primary">Войти</button>
    </form>`;
  document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    const tag = document.getElementById('login-tag').value.trim();
    const pass = document.getElementById('login-password').value;
    const user = findUserByTag(tag);
    if (!user || user.password !== pass) return document.getElementById('login-error').textContent = 'Неверный тег или пароль';
    currentUser = { id: user.id, name: user.name, tag: user.tag, avatar: user.avatar || null };
    setCurrentUser(currentUser);
    goMain();
  });
}

function renderRegister() {
  document.getElementById('auth-forms').innerHTML = `
    <form id="register-form" class="form">
      <div class="input-group"><label>Имя</label><input type="text" id="reg-name" required></div>
      <div class="input-group"><label>Тег</label><input type="text" id="reg-tag" required></div>
      <div class="input-group"><label>Пароль</label><input type="password" id="reg-pass" required></div>
      <div class="input-group"><label>Повторите пароль</label><input type="password" id="reg-pass2" required></div>
      <div class="error-msg" id="reg-error"></div>
      <button type="submit" class="btn-primary">Зарегистрироваться</button>
    </form>`;
  document.getElementById('register-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const tag = document.getElementById('reg-tag').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const pass2 = document.getElementById('reg-pass2').value;
    if (!name || !tag || !pass) return document.getElementById('reg-error').textContent = 'Заполните все поля';
    if (pass !== pass2) return document.getElementById('reg-error').textContent = 'Пароли не совпадают';
    if (findUserByTag(tag)) return document.getElementById('reg-error').textContent = 'Тег занят';
    const newUser = { id: genId(), name, tag, password: pass, avatar: null };
    saveUser(newUser);
    currentUser = { id: newUser.id, name, tag, avatar: null };
    setCurrentUser(currentUser);
    createFavoriteChat(); // сразу создаём "Избранное"
    goMain();
  });
}

function goMain() {
  document.getElementById('loading-screen').style.display = 'none';
  showScreen('main');
  updateSidebar();
  renderChatList();
  attachMainListeners();
}

// ========== ОСНОВНЫЕ ОБРАБОТЧИКИ ==========
function attachMainListeners() {
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });
  document.getElementById('mobile-back-btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('mobile-visible');
  });
  document.getElementById('user-card').addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.toggle('mobile-visible');
    } else {
      showProfile(currentUser.id);
    }
  });
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      activeTab = b.dataset.tab;
      renderChatList();
    });
  });
  document.getElementById('search-input').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.chat-item, .user-item').forEach(el => {
      el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('message-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
  });
  document.getElementById('file-upload-btn').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    pendingFile = { name: file.name, type: file.type };
    document.getElementById('message-input').placeholder = `Файл: ${file.name}`;
  });
  document.getElementById('toggle-favorite').addEventListener('click', () => {
    if (!activeChatId) return;
    const chat = getChat(activeChatId);
    chat.favorite = !chat.favorite;
    saveChat(chat);
    openChat(activeChatId);
    renderChatList();
  });
  document.getElementById('profile-btn-header').addEventListener('click', () => {
    if (!activeChatId) return;
    const chat = getChat(activeChatId);
    const otherId = chat.members.find(m => m !== currentUser.id);
    if (otherId) showProfile(otherId);
  });
}

function showProfile(uid) {
  const user = uid === currentUser.id ? currentUser : getUsers().find(u => u.id === uid);
  if (!user) return;
  const profile = getProfile(uid);
  const modal = document.getElementById('modal-container');
  const overlay = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div style="text-align:center;">
      <div style="background:${profile.banner || '#1b2127'}; height:120px; border-radius:12px; margin-bottom:-40px;"></div>
      <div class="avatar" style="margin:0 auto; width:80px; height:80px; font-size:2rem; border:4px solid var(--bg-secondary);">
        ${user.avatar ? `<img src="${user.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : '<i class="fas fa-user"></i>'}
      </div>
      <h2>${user.name}</h2>
      <p>@${user.tag}</p>
      <p style="color:var(--text-secondary);">${profile.bio || ''}</p>
      ${uid === currentUser.id ? `
        <div style="margin-top:1rem;">
          <label>Баннер URL</label><input type="text" id="profile-banner" value="${profile.banner||''}" style="width:100%; margin-bottom:0.5rem;">
          <label>Аватар URL</label><input type="text" id="profile-avatar" value="${user.avatar||''}" style="width:100%; margin-bottom:0.5rem;">
          <label>О себе</label><input type="text" id="profile-bio" value="${profile.bio||''}" style="width:100%;">
          <button class="btn-primary" id="save-profile">Сохранить</button>
        </div>
      ` : `<button class="btn-primary" id="start-chat-btn">Написать</button>`}
    </div>
  `;
  overlay.style.display = 'block';
  modal.style.display = 'block';
  if (uid === currentUser.id) {
    document.getElementById('save-profile').addEventListener('click', () => {
      const banner = document.getElementById('profile-banner').value;
      const ava = document.getElementById('profile-avatar').value;
      const bio = document.getElementById('profile-bio').value;
      currentUser.avatar = ava;
      setCurrentUser(currentUser);
      saveProfile(uid, { banner, bio });
      updateSidebar();
      overlay.style.display = 'none';
      modal.style.display = 'none';
      renderChatList();
    });
  } else {
    document.getElementById('start-chat-btn').addEventListener('click', () => {
      startPrivateChat(user);
      overlay.style.display = 'none';
      modal.style.display = 'none';
    });
  }
  overlay.addEventListener('click', () => { overlay.style.display = 'none'; modal.style.display = 'none'; });
}

// ========== СТАРТ ==========
window.addEventListener('DOMContentLoaded', () => {
  const saved = getCurrentUser();
  if (saved) {
    currentUser = saved;
    document.getElementById('loading-screen').style.display = 'none';
    showScreen('main');
    updateSidebar();
    renderChatList();
    attachMainListeners();
  } else {
    document.getElementById('loading-screen').style.display = 'none';
    showScreen('auth');
    renderAuthForms();
  }
});
