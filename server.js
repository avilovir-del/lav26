const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Файл данных
const DATA_FILE = path.join(__dirname, 'data.json');

// Кэш данных для производительности
let dataCache = null;
let lastSaveTime = 0;
const SAVE_DEBOUNCE = 1000; // 1 секунда

// Загрузка данных с кэшированием
function loadData() {
  if (dataCache) return dataCache;
  
  try {
    if (fs.existsSync(DATA_FILE)) {
      dataCache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return dataCache;
    }
  } catch (error) {
    console.log('Ошибка загрузки данных, создаем новые:', error.message);
  }
  
  // Данные по умолчанию
  dataCache = {
    admin: {
      password: bcrypt.hashSync("admin123", 10)
    },
    users: {},
    tasks: [
      { id: 1, name: "Покормить персонажа", reward: 5, active: true },
      { id: 2, name: "Поиграть с персонажем", reward: 10, active: true },
      { id: 3, name: "Дать персонажу поспать", reward: 8, active: true }
    ],
    shop: [
      { id: 1, name: "👕 Футболка", price: 10, active: true },
      { id: 2, name: "🎁 Кружка", price: 50, active: true }
    ],
    submissions: [],
    purchases: [],
    purchaseRequests: []
  };
  
  return dataCache;
}

// Сохранение данных с дебаунсингом
function saveData(data) {
  const now = Date.now();
  if (now - lastSaveTime < SAVE_DEBOUNCE) {
    return; // Слишком частые сохранения - пропускаем
  }
  
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    lastSaveTime = now;
    console.log('💾 Данные сохранены');
  } catch (error) {
    console.error('❌ Ошибка сохранения данных:', error);
  }
}

// Инвалидация кэша
function invalidateCache() {
  dataCache = null;
}

// Проверка авторизации
function requireAuth(req, res, next) {
  const token = req.headers.authorization;
  if (token === 'admin') {
    next();
  } else {
    res.status(401).json({ error: 'Не авторизован' });
  }
}

// ======================
// 📊 API ДЛЯ ПРИЛОЖЕНИЯ
// ======================

// Инициализация пользователя при входе
app.post('/api/initialize-user', (req, res) => {
  const { userId, userName, userContact } = req.body;
  
  const data = loadData();
  
  if (!data.users[userId]) {
    data.users[userId] = {
      lavki: 0,
      registrationDate: new Date().toISOString(),
      completedTasks: 0,
      lastActivity: new Date().toISOString(),
      userName: userName || 'Аноним',
      userContact: userContact || 'Не указан',
      settings: {},
      gameState: {},
      completedTaskIds: [] // ДОБАВЛЕНО: список выполненных заданий
    };
    saveData(data);
    console.log('👤 Новый пользователь создан:', userId);
  } else {
    data.users[userId].lastActivity = new Date().toISOString();
    saveData(data);
  }
  
  res.json({ success: true, user: data.users[userId] });
});

// Получить активные задания с информацией о выполнении
app.get('/api/tasks/:userId', (req, res) => {
  const data = loadData();
  const userId = req.params.userId;
  const user = data.users[userId];
  
  const activeTasks = data.tasks.filter(task => task.active).map(task => {
    const userCompleted = user && user.completedTaskIds ? user.completedTaskIds.includes(task.id) : false;
    const pendingSubmission = data.submissions.find(
      s => s.userId === userId && s.taskId === task.id && s.status === 'pending'
    );
    
    return {
      ...task,
      userCompleted: userCompleted,
      pendingApproval: !!pendingSubmission,
      canSubmit: !userCompleted && !pendingSubmission
    };
  });
  
  res.json(activeTasks);
});

// Отправить задание на проверку
app.post('/api/submit-task', (req, res) => {
  const { taskId, photo, userId, userName, userContact } = req.body;
  
  const data = loadData();
  const task = data.tasks.find(t => t.id === taskId);
  const user = data.users[userId];
  
  if (!task) {
    return res.status(404).json({ error: 'Задание не найдено' });
  }

  // ПРОВЕРКА: задание уже выполнено
  if (user && user.completedTaskIds && user.completedTaskIds.includes(taskId)) {
    return res.status(400).json({ error: 'Задание уже выполнено' });
  }

  // ПРОВЕРКА: задание уже на проверке
  const existingSubmission = data.submissions.find(
    s => s.userId === userId && s.taskId === taskId && s.status === 'pending'
  );
  if (existingSubmission) {
    return res.status(400).json({ error: 'Задание уже отправлено на проверку' });
  }

  // Создаем или обновляем данные пользователя
  if (!user) {
    data.users[userId] = {
      lavki: 0,
      registrationDate: new Date().toISOString(),
      completedTasks: 0,
      lastActivity: new Date().toISOString(),
      userName: userName || 'Аноним',
      userContact: userContact || 'Не указан',
      settings: {},
      gameState: {},
      completedTaskIds: []
    };
  } else {
    data.users[userId].lastActivity = new Date().toISOString();
    data.users[userId].userName = userName || data.users[userId].userName;
    data.users[userId].userContact = userContact || data.users[userId].userContact;
  }

  // Создаем submission
  const submission = {
    id: Date.now(),
    taskId,
    taskName: task.name,
    userId,
    userName: userName || 'Аноним',
    userContact: userContact || 'Не указан',
    photo,
    reward: task.reward,
    status: 'pending',
    submittedAt: new Date().toISOString()
  };

  data.submissions.push(submission);
  saveData(data);

  res.json({ success: true, message: 'Задание отправлено на проверку' });
});

// Получить баланс пользователя
app.get('/api/user/:userId/balance', (req, res) => {
  const data = loadData();
  const userId = req.params.userId;
  const user = data.users[userId] || { lavki: 0 };
  res.json({ lavki: user.lavki });
});

// Получить покупки пользователя
app.get('/api/user/:userId/purchases', (req, res) => {
  const data = loadData();
  const userId = req.params.userId;
  const userPurchases = (data.purchases || []).filter(p => p.userId === userId);
  
  userPurchases.sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
  
  res.json(userPurchases);
});

// Получить товары магазина
app.get('/api/shop', (req, res) => {
  const data = loadData();
  const activeItems = data.shop.filter(item => item.active);
  res.json(activeItems);
});

// ======================
// 🛒 API ДЛЯ ПОКУПОК И ЗАЯВОК
// ======================

// Отправить заявку на покупку
app.post('/api/buy-item', (req, res) => {
  const { itemId, itemName, price, userId, userName, userContact } = req.body;
  const data = loadData();
  
  // Проверяем баланс пользователя
  if (!data.users[userId] || data.users[userId].lavki < price) {
    return res.status(400).json({ error: 'Недостаточно лавок' });
  }
  
  // Создаем заявку
  if (!data.purchaseRequests) {
    data.purchaseRequests = [];
  }
  
  const purchaseRequest = {
    id: Date.now(),
    itemId,
    itemName,
    price,
    userId,
    userName: userName || 'Неизвестный',
    userContact: userContact || 'Не указан',
    status: 'pending',
    requestedAt: new Date().toISOString(),
    processedAt: null
  };
  
  data.purchaseRequests.push(purchaseRequest);
  saveData(data);
  
  res.json({ success: true, message: 'Заявка на покупку отправлена администратору' });
});

// Получить все заявки на покупку (для админки)
app.get('/api/admin/purchase-requests', requireAuth, (req, res) => {
  const data = loadData();
  const requests = data.purchaseRequests || [];
  requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  res.json(requests);
});

// Обработать заявку на покупку
app.post('/api/admin/purchase-requests/:id/process', requireAuth, (req, res) => {
  const { status, adminNotes } = req.body;
  const requestId = parseInt(req.params.id);
  const data = loadData();
  
  const request = data.purchaseRequests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ error: 'Заявка не найдена' });
  }
  
  request.status = status;
  request.processedAt = new Date().toISOString();
  request.adminNotes = adminNotes;
  
  // Если подтверждено, списываем лавки и создаем покупку
  if (status === 'approved' && data.users[request.userId]) {
    if (data.users[request.userId].lavki >= request.price) {
      data.users[request.userId].lavki -= request.price;
      
      // Сохраняем историю покупок
      if (!data.purchases) {
        data.purchases = [];
      }
      data.purchases.push({
        id: Date.now(),
        itemId: request.itemId,
        itemName: request.itemName,
        price: request.price,
        userId: request.userId,
        userName: request.userName,
        purchasedAt: new Date().toISOString()
      });
    }
  }
  
  saveData(data);
  res.json({ success: true, message: `Заявка ${status === 'approved' ? 'подтверждена' : 'отклонена'}` });
});

// ======================
// 🔄 ПРОВЕРКА ПОДТВЕРЖДЕННЫХ ЗАДАНИЙ
// ======================

// Получить подтвержденные задания для пользователя
app.get('/api/user/:userId/approved-tasks', (req, res) => {
  const userId = req.params.userId;
  const data = loadData();
  
  // Находим все подтвержденные задания пользователя
  const approvedSubmissions = data.submissions.filter(
    s => s.userId === userId && s.status === 'approved' && !s.processed
  );
  
  // Отмечаем их как обработанные и возвращаем
  const newApprovedTasks = [];
  approvedSubmissions.forEach(submission => {
    newApprovedTasks.push({
      taskId: submission.taskId,
      taskName: submission.taskName,
      reward: submission.reward
    });
    submission.processed = true;
    
    // ДОБАВЛЕНО: помечаем задание как выполненное у пользователя
    if (data.users[userId]) {
      if (!data.users[userId].completedTaskIds) {
        data.users[userId].completedTaskIds = [];
      }
      if (!data.users[userId].completedTaskIds.includes(submission.taskId)) {
        data.users[userId].completedTaskIds.push(submission.taskId);
      }
      data.users[userId].completedTasks = (data.users[userId].completedTasks || 0) + 1;
    }
  });
  
  saveData(data);
  res.json(newApprovedTasks);
});

// Получить отклоненные задания для пользователя
app.get('/api/user/:userId/rejected-tasks', (req, res) => {
  const userId = req.params.userId;
  const data = loadData();
  
  // Находим все отклоненные задания пользователя
  const rejectedSubmissions = data.submissions.filter(
    s => s.userId === userId && s.status === 'rejected' && !s.userNotified
  );
  
  // Отмечаем их как уведомленные и возвращаем
  const rejectedTasks = [];
  rejectedSubmissions.forEach(submission => {
    rejectedTasks.push({
      taskId: submission.taskId,
      taskName: submission.taskName,
      rejectionReason: submission.rejectionReason || 'Попробуйте ещё раз'
    });
    submission.userNotified = true;
  });
  
  saveData(data);
  res.json(rejectedTasks);
});

// ======================
// 👥 API ДЛЯ ПОЛЬЗОВАТЕЛЕЙ
// ======================

// Получить список всех пользователей
app.get('/api/admin/users', requireAuth, (req, res) => {
  const data = loadData();
  
  const users = Object.entries(data.users).map(([userId, userData]) => ({
    id: userId,
    lavki: userData.lavki || 0,
    registrationDate: userData.registrationDate || 'Неизвестно',
    completedTasks: userData.completedTasks || 0,
    lastActivity: userData.lastActivity || 'Неизвестно',
    userName: userData.userName || 'Аноним',
    userContact: userData.userContact || 'Не указан',
    completedTaskIds: userData.completedTaskIds || []
  }));
  
  res.json(users);
});

// Получить детальную информацию о пользователе
app.get('/api/admin/users/:userId', requireAuth, (req, res) => {
  const data = loadData();
  const userId = req.params.userId;
  
  const user = data.users[userId];
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  
  const userSubmissions = data.submissions.filter(s => s.userId === userId);
  const userPurchases = (data.purchases || []).filter(p => p.userId === userId);
  const userRequests = (data.purchaseRequests || []).filter(r => r.userId === userId);
  
  const userInfo = {
    id: userId,
    lavki: user.lavki || 0,
    registrationDate: user.registrationDate || 'Неизвестно',
    completedTasks: user.completedTasks || 0,
    lastActivity: user.lastActivity || 'Неизвестно',
    userName: user.userName || 'Аноним',
    userContact: user.userContact || 'Не указан',
    completedTaskIds: user.completedTaskIds || [],
    totalSubmissions: userSubmissions.length,
    approvedSubmissions: userSubmissions.filter(s => s.status === 'approved').length,
    pendingSubmissions: userSubmissions.filter(s => s.status === 'pending').length,
    rejectedSubmissions: userSubmissions.filter(s => s.status === 'rejected').length,
    totalPurchases: userPurchases.length,
    totalRequests: userRequests.length,
    submissions: userSubmissions,
    purchases: userPurchases
  };
  
  res.json(userInfo);
});

// Обновить баланс пользователя
app.put('/api/admin/users/:userId/balance', requireAuth, (req, res) => {
  const { lavki } = req.body;
  const userId = req.params.userId;
  const data = loadData();
  
  if (!data.users[userId]) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  
  data.users[userId].lavki = parseInt(lavki);
  saveData(data);
  
  res.json({ success: true, message: 'Баланс обновлен' });
});

// Сброс персонажа пользователя
app.post('/api/admin/users/:userId/reset', requireAuth, (req, res) => {
  const userId = req.params.userId;
  const data = loadData();
  
  if (!data.users[userId]) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  
  // Сбрасываем данные пользователя
  data.users[userId].lavki = 0;
  data.users[userId].completedTasks = 0;
  data.users[userId].lastActivity = new Date().toISOString();
  data.users[userId].settings = {};
  data.users[userId].gameState = {};
  data.users[userId].completedTaskIds = [];
  
  // Удаляем все submissions пользователя
  data.submissions = data.submissions.filter(s => s.userId !== userId);
  
  // Удаляем покупки пользователя
  if (data.purchases) {
    data.purchases = data.purchases.filter(p => p.userId !== userId);
  }
  
  // Удаляем заявки на покупку пользователя
  if (data.purchaseRequests) {
    data.purchaseRequests = data.purchaseRequests.filter(r => r.userId !== userId);
  }
  
  saveData(data);
  
  res.json({ success: true, message: 'Персонаж пользователя сброшен' });
});

// ======================
// 💾 ПОЛНОЕ СОХРАНЕНИЕ СОСТОЯНИЯ ПОЛЬЗОВАТЕЛЯ
// ======================

// Сохранить полное состояние пользователя
app.post('/api/user/:userId/state', (req, res) => {
  const { state } = req.body;
  const userId = req.params.userId;
  const data = loadData();
  
  if (!data.users[userId]) {
    data.users[userId] = {
      lavki: 0,
      registrationDate: new Date().toISOString(),
      completedTasks: 0,
      lastActivity: new Date().toISOString(),
      userName: 'Аноним',
      userContact: 'Не указан',
      settings: {},
      gameState: {},
      completedTaskIds: []
    };
  }
  
  // Сохраняем полное состояние
  data.users[userId].gameState = { 
    ...data.users[userId].gameState, 
    ...state 
  };
  data.users[userId].lastActivity = new Date().toISOString();
  data.users[userId].lavki = state.lavki !== undefined ? state.lavki : data.users[userId].lavki;
  
  saveData(data);
  res.json({ success: true, state: data.users[userId].gameState });
});

// Получить полное состояние пользователя
app.get('/api/user/:userId/state', (req, res) => {
  const data = loadData();
  const userId = req.params.userId;
  
  const user = data.users[userId];
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  
  res.json({
    lavki: user.lavki || 0,
    settings: user.settings || {},
    gameState: user.gameState || {},
    completedTasks: user.completedTasks || 0,
    completedTaskIds: user.completedTaskIds || [],
    registrationDate: user.registrationDate
  });
});

// ======================
// 🔧 API ДЛЯ АДМИНКИ
// ======================

// Авторизация в админке
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const data = loadData();
  
  if (bcrypt.compareSync(password, data.admin.password)) {
    res.json({ success: true, token: 'admin' });
  } else {
    res.status(401).json({ error: 'Неверный пароль' });
  }
});

// Сменить пароль админа
app.post('/api/admin/change-password', requireAuth, (req, res) => {
  const { newPassword } = req.body;
  const data = loadData();
  
  data.admin.password = bcrypt.hashSync(newPassword, 10);
  saveData(data);
  
  res.json({ success: true, message: 'Пароль изменен' });
});

// Получить все submissions
app.get('/api/admin/submissions', requireAuth, (req, res) => {
  const data = loadData();
  res.json(data.submissions);
});

// Подтвердить задание
app.post('/api/admin/submissions/:id/approve', requireAuth, (req, res) => {
  const submissionId = parseInt(req.params.id);
  const data = loadData();
  
  const submission = data.submissions.find(s => s.id === submissionId);
  if (!submission) {
    return res.status(404).json({ error: 'Submission не найден' });
  }
  
  // Обновляем статус
  submission.status = 'approved';
  submission.reviewedAt = new Date().toISOString();
  submission.processed = false;
  
  // Начисляем лавки пользователю
  const userId = submission.userId;
  if (!data.users[userId]) {
    data.users[userId] = { 
      lavki: 0,
      completedTasks: 0,
      registrationDate: new Date().toISOString(),
      settings: {},
      gameState: {},
      completedTaskIds: []
    };
  }
  data.users[userId].lavki += submission.reward;
  data.users[userId].completedTasks = (data.users[userId].completedTasks || 0) + 1;
  data.users[userId].lastActivity = new Date().toISOString();
  
  // ДОБАВЛЕНО: помечаем задание как выполненное
  if (!data.users[userId].completedTaskIds) {
    data.users[userId].completedTaskIds = [];
  }
  if (!data.users[userId].completedTaskIds.includes(submission.taskId)) {
    data.users[userId].completedTaskIds.push(submission.taskId);
  }
  
  saveData(data);
  res.json({ 
    success: true, 
    message: 'Задание подтверждено',
    userNotified: false
  });
});

// Отклонить задание
app.post('/api/admin/submissions/:id/reject', requireAuth, (req, res) => {
  const submissionId = parseInt(req.params.id);
  const data = loadData();
  
  const submission = data.submissions.find(s => s.id === submissionId);
  if (!submission) {
    return res.status(404).json({ error: 'Submission не найден' });
  }
  
  // Запрашиваем причину отклонения
  const { rejectionReason } = req.body;
  
  submission.status = 'rejected';
  submission.reviewedAt = new Date().toISOString();
  submission.rejectionReason = rejectionReason || 'Попробуйте ещё раз';
  submission.userNotified = false;
  
  saveData(data);
  res.json({ success: true, message: 'Задание отклонено' });
});

// Управление заданиями
app.get('/api/admin/tasks', requireAuth, (req, res) => {
  const data = loadData();
  res.json(data.tasks);
});

app.post('/api/admin/tasks', requireAuth, (req, res) => {
  const { name, reward } = req.body;
  const data = loadData();
  
  const newTask = {
    id: Date.now(),
    name,
    reward: parseInt(reward),
    active: true
  };
  
  data.tasks.push(newTask);
  saveData(data);
  
  res.json({ success: true, task: newTask });
});

app.put('/api/admin/tasks/:id', requireAuth, (req, res) => {
  const taskId = parseInt(req.params.id);
  const { name, reward, active } = req.body;
  const data = loadData();
  
  const task = data.tasks.find(t => t.id === taskId);
  if (task) {
    if (name !== undefined) task.name = name;
    if (reward !== undefined) task.reward = parseInt(reward);
    if (active !== undefined) task.active = active;
    
    saveData(data);
    res.json({ success: true, task });
  } else {
    res.status(404).json({ error: 'Задание не найдено' });
  }
});

// Управление магазином
app.get('/api/admin/shop', requireAuth, (req, res) => {
  const data = loadData();
  res.json(data.shop);
});

app.post('/api/admin/shop', requireAuth, (req, res) => {
  const { name, price } = req.body;
  const data = loadData();
  
  const newItem = {
    id: Date.now(),
    name,
    price: parseInt(price),
    active: true
  };
  
  data.shop.push(newItem);
  saveData(data);
  
  res.json({ success: true, item: newItem });
});

app.put('/api/admin/shop/:id', requireAuth, (req, res) => {
  const itemId = parseInt(req.params.id);
  const { name, price, active } = req.body;
  const data = loadData();
  
  const item = data.shop.find(i => i.id === itemId);
  if (item) {
    if (name !== undefined) item.name = name;
    if (price !== undefined) item.price = parseInt(price);
    if (active !== undefined) item.active = active;
    
    saveData(data);
    res.json({ success: true, item });
  } else {
    res.status(404).json({ error: 'Товар не найден' });
  }
});

// Получить историю покупок
app.get('/api/admin/purchases', requireAuth, (req, res) => {
  const data = loadData();
  res.json(data.purchases || []);
});

// Статистика
app.get('/api/admin/stats', requireAuth, (req, res) => {
  const data = loadData();
  
  const users = Object.values(data.users);
  const activeUsers = users.filter(user => {
    if (!user.lastActivity) return false;
    const lastActivity = new Date(user.lastActivity);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return lastActivity > weekAgo;
  });
  
  const purchaseRequests = data.purchaseRequests || [];
  const pendingRequests = purchaseRequests.filter(r => r.status === 'pending');
  
  const stats = {
    totalUsers: users.length,
    activeUsers: activeUsers.length,
    totalSubmissions: data.submissions.length,
    pendingSubmissions: data.submissions.filter(s => s.status === 'pending').length,
    rejectedSubmissions: data.submissions.filter(s => s.status === 'rejected').length,
    totalLavki: users.reduce((sum, user) => sum + (user.lavki || 0), 0),
    activeTasks: data.tasks.filter(t => t.active).length,
    activeShopItems: data.shop.filter(i => i.active).length,
    totalPurchases: (data.purchases || []).length,
    totalPurchaseRequests: purchaseRequests.length,
    pendingPurchaseRequests: pendingRequests.length
  };
  
  res.json(stats);
});

// Раздача статических файлов
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Обработка ошибок
app.use((error, req, res, next) => {
  console.error('Ошибка сервера:', error);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 Приложение: http://localhost:${PORT}`);
  console.log(`📊 Админ-панель: http://localhost:${PORT}/admin`);
  console.log(`🔑 Пароль по умолчанию: admin123`);
  console.log(`💾 Файл данных: ${DATA_FILE}`);
});

module.exports = app;
