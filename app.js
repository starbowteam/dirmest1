(function() {
  // ========== ХРАНИЛИЩЕ ==========
  const KEYS = {
    USERS: 'drm_users',
    CURRENT_USER: 'drm_currentUser',
    MESSAGES: 'drm_messages',
    CHATS: 'drm_chats',
    WALL: 'drm_wall'
  };
  function initStorage() {
    for (let key of Object.values(KEYS)) {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(key === KEYS.MESSAGES || key === KEYS.CHATS ? {} : []));
      }
    }
  }
  const getUsers = () => JSON.parse(localStorage.getItem(KEYS.USERS));
  const saveUser = user => {
    const users = getUsers();
    users.push(user);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  };
  const findUserByTag = tag => getUsers().find(u => u.tag?.toLowerCase() === tag?.toLowerCase());
  const getCurrentUser = () => JSON.parse(localStorage.getItem(KEYS.CURRENT_USER));
  const setCurrentUser = user => localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
  const getUserChats = userId => {
    const all = JSON.parse(localStorage.getItem(KEYS.CHATS));
    return all[userId] || [];
  };
  const addChatToUser = (userId, chatId) => {
    const all = JSON.parse(localStorage.getItem(KEYS.CHATS));
    if (!all[userId]) all[userId] = [];
    if (!all[userId].includes(chatId)) all[userId].push(chatId);
    localStorage.setItem(KEYS.CHATS, JSON.stringify(all));
  };
  const saveChatMeta = chat => localStorage.setItem(`chat_${chat.id}`, JSON.stringify(chat));
  const getChatMeta = chatId => JSON.parse(localStorage.getItem(`chat_${chatId}`));
  const getMessages = chatId => {
    const all = JSON.parse(localStorage.getItem(KEYS.MESSAGES));
    return all[chatId] || [];
  };
  const saveMessage = (chatId, msg) => {
    const all = JSON.parse(localStorage.getItem(KEYS.MESSAGES));
    if (!all[chatId]) all[chatId] = [];
    all[chatId].push(msg);
    localStorage.setItem(KEYS.MESSAGES, JSON.stringify(all));
  };
  const getAllWallPosts = () => JSON.parse(localStorage.getItem(KEYS.WALL));
  const addWallPost = post => {
    const posts = getAllWallPosts();
    posts.unshift(post);
    localStorage.setItem(KEYS.WALL, JSON.stringify(posts));
  };

  // ========== УТИЛИТЫ ==========
  const generateId = () => Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
  const formatTime = timestamp => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    if (now - date < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
  };

  // ========== EVENT BUS ==========
  class EventBus {
    constructor() { this.listeners = {}; }
    on(event, callback) { (this.listeners[event] ||= []).push(callback); }
    emit(event, data) { (this.listeners[event] || []).forEach(cb => cb(data)); }
  }

  // ========== РОУТЕР ==========
  class Router {
    constructor(pages) { this.pages = pages; }
    navigate(page, payload = null) {
      document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
      if (this.pages[page]) {
        this.pages[page].render(payload);
        window.eventBus.emit('route:changed', { page, payload });
      }
    }
  }

  // ========== АВТОРИЗАЦИЯ ==========
  const AuthUI = {
    render() {
      const container = document.getElementById('auth-container');
      container.style.display = 'flex';
      container.innerHTML = `
        <div class="auth-screen">
          <div class="auth-header"><h1>.drm</h1><p>серебряный мессенджер</p></div>
          <div class="auth-tabs">
            <button class="auth-tab active" data-tab="login">Вход</button>
            <button class="auth-tab" data-tab="register">Регистрация</button>
          </div>
          <div id="auth-forms"></div>
        </div>
      `;
      this.showLoginForm();
      this.attachTabs();
    },
    showLoginForm() {
      document.getElementById('auth-forms').innerHTML = `
        <form class="auth-form" id="login-form">
          <div class="input-group"><label>Тег</label><input type="text" id="loginTag" placeholder="your_tag"></div>
          <div class="input-group"><label>Пароль</label><input type="password" id="loginPassword" placeholder="••••••••"></div>
          <div class="error-message" id="loginError"></div>
          <button type="submit" class="btn-primary">Войти</button>
        </form>
      `;
      document.getElementById('login-form').addEventListener('submit', e => {
        e.preventDefault();
        const tag = document.getElementById('loginTag').value.trim();
        const pass = document.getElementById('loginPassword').value;
        try {
          const user = login(tag, pass);
          setCurrentUser(user);
          window.appRouter.navigate('main', { user });
        } catch (err) {
          document.getElementById('loginError').textContent = err.message;
        }
      });
    },
    showRegisterForm() {
      document.getElementById('auth-forms').innerHTML = `
        <form class="auth-form" id="register-form">
          <div class="input-group"><label>Имя</label><input type="text" id="regName" placeholder="Виктор"></div>
          <div class="input-group"><label>Тег</label><input type="text" id="regTag" placeholder="viktor"></div>
          <div class="input-group"><label>Пароль</label><input type="password" id="regPassword" placeholder="••••••••"></div>
          <div class="error-message" id="regError"></div>
          <button type="submit" class="btn-primary">Зарегистрироваться</button>
        </form>
      `;
      document.getElementById('register-form').addEventListener('submit', e => {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const tag = document.getElementById('regTag').value.trim();
        const pass = document.getElementById('regPassword').value;
        try {
          const user = register(name, tag, pass);
          setCurrentUser(user);
          window.appRouter.navigate('main', { user });
        } catch (err) {
          document.getElementById('regError').textContent = err.message;
        }
      });
    },
    attachTabs() {
      document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          if (tab.dataset.tab === 'login') this.showLoginForm();
          else this.showRegisterForm();
        });
      });
    }
  };

  function login(tag, password) {
    const user = findUserByTag(tag);
    if (!user) throw new Error('Пользователь не найден');
    if (user.password !== password) throw new Error('Неверный пароль');
    const session = { ...user };
    delete session.password;
    return session;
  }

  function register(name, tag, password) {
    if (!name || !tag || !password) throw new Error('Заполните все поля');
    if (tag.length < 3) throw new Error('Тег должен быть не менее 3 символов');
    if (password.length < 4) throw new Error('Пароль должен быть не менее 4 символов');
    if (findUserByTag(tag)) throw new Error('Этот тег уже занят');
    const newUser = {
      id: generateId(),
      name,
      tag,
      password,
      avatar: name.charAt(0).toUpperCase()
    };
    saveUser(newUser);
    const session = { ...newUser };
    delete session.password;
    return session;
  }

  // ========== ГЛАВНЫЙ ЭКРАН ==========
  const MainUI = {
    render(payload) {
      const container = document.getElementById('main-container');
      container.innerHTML = `
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-header">
            <div class="user-profile" id="profileBtn">
              <div class="avatar avatar-lg">${payload.user.avatar}</div>
              <div class="user-info">
                <strong>${payload.user.name}</strong>
                <span class="status">онлайн</span>
              </div>
            </div>
            <button class="icon-btn" id="logoutBtn"><i class="fas fa-sign-out-alt"></i></button>
          </div>
          <div class="search-box"><i class="fas fa-search"></i><input type="text" id="searchInput" placeholder="Поиск..."></div>
          <div class="chat-tabs">
            <button class="tab-btn active" data-tab="chats">Чаты</button>
            <button class="tab-btn" data-tab="groups">Группы</button>
            <button class="tab-btn" data-tab="wall">Стена</button>
            <button class="tab-btn" data-tab="users">Люди</button>
          </div>
          <div class="chat-list-container" id="chatList"></div>
          <button class="new-chat-btn" id="newChatBtn"><i class="fas fa-plus"></i> Новый чат</button>
        </aside>
        <main class="chat-area" id="chatArea">
          <div class="chat-header">
            <button class="mobile-back-btn" id="mobileBackBtn"><i class="fas fa-arrow-left"></i></button>
            <div class="chat-info">
              <div class="avatar" id="chatAvatar"></div>
              <div class="chat-details">
                <h3 id="chatTitle">Выберите чат</h3>
                <p id="chatSubtitle"></p>
              </div>
            </div>
            <div class="chat-actions"></div>
          </div>
          <div class="messages-container" id="messagesContainer">
            <div class="empty-chat-message"><i class="fas fa-comments"></i><p>Выберите чат</p></div>
          </div>
          <div class="message-input-area" id="messageInputArea" style="display: none;">
            <input type="text" id="messageInput" placeholder="Сообщение...">
            <button class="send-btn" id="sendMessageBtn"><i class="fas fa-paper-plane"></i></button>
          </div>
        </main>
      `;
      container.style.display = 'flex';
      const user = payload.user;
      window.currentUser = user;
      window.sidebar = new Sidebar(user, (chatId) => {
        window.chat = new ChatUI(user, chatId);
        if (window.innerWidth <= 768) document.getElementById('sidebar').classList.add('hidden');
      });
      document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem(KEYS.CURRENT_USER);
        location.reload();
      });
      document.getElementById('mobileBackBtn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('hidden');
      });
    }
  };

  // ========== САЙДБАР ==========
  class Sidebar {
    constructor(user, onChatSelect) {
      this.user = user;
      this.onChatSelect = onChatSelect;
      this.currentTab = 'chats';
      this.loadChats();
      this.attachEvents();
    }

    loadChats() {
      const container = document.getElementById('chatList');
      if (this.currentTab === 'wall') {
        new WallUI(this.user);
        if (window.innerWidth <= 768) document.getElementById('sidebar').classList.add('hidden');
        return;
      }
      if (this.currentTab === 'users') {
        const users = getUsers().filter(u => u.id !== this.user.id);
        container.innerHTML = users.map(u => `
          <div class="chat-item" data-user-id="${u.id}">
            <div class="avatar avatar-lg">${u.avatar}</div>
            <div class="chat-item-info">
              <div class="chat-item-title">${u.name}</div>
              <div class="chat-item-lastmsg">@${u.tag}</div>
            </div>
          </div>
        `).join('');
        container.querySelectorAll('.chat-item').forEach(el => {
          el.addEventListener('click', () => {
            const target = users.find(u => u.id === el.dataset.userId);
            if (target) {
              const chat = createOrGetPrivateChat(this.user, target);
              this.onChatSelect(chat.id);
            }
          });
        });
        return;
      }
      const chatIds = getUserChats(this.user.id);
      const chats = chatIds.map(getChatMeta).filter(Boolean);
      const filtered = this.currentTab === 'groups' ? chats.filter(c => c.type === 'group') : chats.filter(c => c.type !== 'group');
      if (!filtered.length) {
        container.innerHTML = '<div style="padding:20px;color:var(--text-secondary)">Пусто</div>';
        return;
      }
      container.innerHTML = filtered.map(chat => {
        const other = chat.participants?.find(p => p.id !== this.user.id) || {};
        const name = chat.name || other.name || 'Группа';
        const avatar = chat.avatar || other.avatar || '?';
        const badge = chat.type === 'group' ? '<span class="badge">группа</span>' : '';
        return `
          <div class="chat-item" data-id="${chat.id}">
            <div class="avatar avatar-lg">${avatar}</div>
            <div class="chat-item-info">
              <div class="chat-item-title">
                <span>${name} ${badge}</span>
                <span>${formatTime(chat.updatedAt)}</span>
              </div>
              <div class="chat-item-lastmsg">${chat.lastMessage || '...'}</div>
            </div>
          </div>
        `;
      }).join('');
      container.querySelectorAll('.chat-item').forEach(el => {
        el.addEventListener('click', () => this.onChatSelect(el.dataset.id));
      });
    }

    attachEvents() {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentTab = btn.dataset.tab;
          this.loadChats();
        });
      });
      document.getElementById('searchInput').addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.chat-item').forEach(el => {
          const title = el.querySelector('.chat-item-title span')?.textContent?.toLowerCase() || '';
          el.style.display = title.includes(q) ? '' : 'none';
        });
      });
      document.getElementById('newChatBtn').addEventListener('click', () => this.showNewChatModal());
    }

    showNewChatModal() {
      const modal = document.getElementById('modal-container');
      const overlay = document.getElementById('modal-overlay');
      modal.innerHTML = `
        <h3>Новый чат</h3>
        <div class="input-group"><label>Тег пользователя</label><input type="text" id="modalTag" placeholder="@viktor"></div>
        <div class="error-message" id="modalError"></div>
        <div style="display:flex; gap:8px; margin-top:16px;">
          <button class="btn-primary" id="modalCreate">Создать</button>
          <button class="btn-secondary" id="modalCancel">Отмена</button>
        </div>
      `;
      overlay.style.display = 'block';
      modal.style.display = 'block';
      document.getElementById('modalCreate').onclick = () => {
        const tag = document.getElementById('modalTag').value.trim().replace('@', '');
        const target = findUserByTag(tag);
        if (!target) return document.getElementById('modalError').textContent = 'Пользователь не найден';
        const chat = createOrGetPrivateChat(this.user, target);
        overlay.style.display = 'none';
        modal.style.display = 'none';
        this.onChatSelect(chat.id);
        this.loadChats();
      };
      document.getElementById('modalCancel').onclick = () => { overlay.style.display = 'none'; modal.style.display = 'none'; };
    }
  }

  function createOrGetPrivateChat(currentUser, targetUser) {
    if (targetUser.id === currentUser.id) throw new Error('Нельзя создать чат с самим собой');
    const existing = getUserChats(currentUser.id).map(getChatMeta).find(c => c.type !== 'group' && c.participants.some(p => p.id === targetUser.id));
    if (existing) return existing;
    const chat = {
      id: generateId(),
      type: 'private',
      participants: [
        { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar },
        { id: targetUser.id, name: targetUser.name, avatar: targetUser.avatar }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMessage: ''
    };
    saveChatMeta(chat);
    addChatToUser(currentUser.id, chat.id);
    addChatToUser(targetUser.id, chat.id);
    return chat;
  }

  // ========== ЧАТ ==========
  class ChatUI {
    constructor(user, chatId) {
      this.user = user;
      this.chatId = chatId;
      this.render();
    }

    render() {
      const chat = getChatMeta(this.chatId);
      if (!chat) return;
      const other = chat.participants?.find(p => p.id !== this.user.id) || {};
      document.getElementById('chatTitle').textContent = chat.name || other.name || 'Чат';
      document.getElementById('chatSubtitle').textContent = chat.type === 'group' ? `${chat.participants.length} участников` : 'онлайн';
      document.getElementById('chatAvatar').textContent = chat.avatar || other.avatar || '?';
      document.getElementById('messageInputArea').style.display = 'flex';
      document.getElementById('messageInput').placeholder = 'Сообщение...';
      this.loadMessages();
      this.attachSend();
    }

    loadMessages() {
      const msgs = getMessages(this.chatId);
      const container = document.getElementById('messagesContainer');
      if (!msgs.length) {
        container.innerHTML = '<div class="empty-chat-message"><i class="fas fa-comments"></i><p>Нет сообщений</p></div>';
        return;
      }
      container.innerHTML = msgs.map(m => {
        const own = m.senderId === this.user.id;
        return `
          <div class="message-row ${own ? 'own' : ''}">
            <div class="message-avatar">${m.senderAvatar}</div>
            <div class="message-bubble">${m.text}<div class="message-meta">${formatTime(m.timestamp)}</div></div>
          </div>
        `;
      }).join('');
      container.scrollTop = container.scrollHeight;
    }

    attachSend() {
      const input = document.getElementById('messageInput');
      const sendBtn = document.getElementById('sendMessageBtn');
      const send = () => {
        const text = input.value.trim();
        if (!text) return;
        const msg = {
          id: generateId(),
          chatId: this.chatId,
          senderId: this.user.id,
          senderAvatar: this.user.avatar,
          text,
          timestamp: Date.now()
        };
        saveMessage(this.chatId, msg);
        const chat = getChatMeta(this.chatId);
        chat.lastMessage = text;
        chat.updatedAt = Date.now();
        saveChatMeta(chat);
        this.loadMessages();
        input.value = '';
        window.eventBus.emit('message:sent');
      };
      sendBtn.onclick = send;
      input.onkeypress = e => { if (e.key === 'Enter') send(); };
    }
  }

  // ========== СТЕНА ==========
  class WallUI {
    constructor(user) {
      this.user = user;
      this.render();
    }

    render() {
      document.getElementById('chatTitle').textContent = 'Общая стена';
      document.getElementById('chatSubtitle').textContent = 'Сообщество .drm';
      document.getElementById('chatAvatar').textContent = '🌐';
      document.getElementById('messageInputArea').style.display = 'flex';
      document.getElementById('messageInput').placeholder = 'Что нового?';
      this.loadPosts();
      this.attachSend();
    }

    loadPosts() {
      const posts = getAllWallPosts();
      const container = document.getElementById('messagesContainer');
      if (!posts.length) {
        container.innerHTML = '<div class="empty-chat-message"><i class="fas fa-newspaper"></i><p>На стене пока пусто</p></div>';
        return;
      }
      container.innerHTML = posts.map(p => `
        <div class="wall-post">
          <div class="post-header">
            <div class="avatar">${p.authorAvatar}</div>
            <div>
              <div class="post-author">${p.authorName}</div>
              <div class="post-time">${formatTime(p.timestamp)}</div>
            </div>
          </div>
          <div class="post-content">${p.content}</div>
          <div class="post-actions">
            <span><i class="far fa-heart"></i> ${p.likes?.length || 0}</span>
            <span><i class="far fa-comment"></i></span>
          </div>
        </div>
      `).join('');
      container.scrollTop = container.scrollHeight;
    }

    attachSend() {
      const input = document.getElementById('messageInput');
      const sendBtn = document.getElementById('sendMessageBtn');
      const send = () => {
        const text = input.value.trim();
        if (!text) return;
        addWallPost({
          id: generateId(),
          authorId: this.user.id,
          authorName: this.user.name,
          authorAvatar: this.user.avatar,
          content: text,
          timestamp: Date.now(),
          likes: []
        });
        this.loadPosts();
        input.value = '';
      };
      sendBtn.onclick = send;
      input.onkeypress = e => { if (e.key === 'Enter') send(); };
    }
  }

  // ========== ИНИЦИАЛИЗАЦИЯ ==========
  initStorage();
  window.eventBus = new EventBus();
  window.appRouter = new Router({ auth: AuthUI, main: MainUI });

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loading').style.display = 'none';
    const savedUser = getCurrentUser();
    if (savedUser) {
      window.appRouter.navigate('main', { user: savedUser });
    } else {
      window.appRouter.navigate('auth');
    }
  });
})();
