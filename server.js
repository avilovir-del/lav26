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

// Загрузка данных
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (error) {
    console.log('Ошибка загрузки данных, создаем новые:', error.message);
  }
  
  // Данные по умолчанию
  return {
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
    purchases: []
  };
}

// Сохранение данных
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
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

// Получить активные задания
app.get('/api/tasks', (req, res) => {
  const data = loadData();
  const activeTasks = data.tasks.filter(task => task.active);
  res.json(activeTasks);
});

// Отправить задание на проверку
app.post('/api/submit-task', (req, res) => {
  const { taskId, photo, userId, userName } = req.body;
  
  const data = loadData();
  const task = data.tasks.find(t => t.id === taskId);
  
  if (!task) {
    return res.status(404).json({ error: 'Задание не найдено' });
  }

  // Создаем или обновляем данные пользователя
  if (!data.users[userId]) {
    data.users[userId] = {
      lavki: 0,
      registrationDate: new Date().toISOString(),
      completedTasks: 0,
      lastActivity: new Date().toISOString()
    };
  } else {
    data.users[userId].lastActivity = new Date().toISOString();
  }

  // Создаем submission
  const submission = {
    id: Date.now(),
    taskId,
    taskName: task.name,
    userId: userId || 'unknown',
    userName: userName || 'Аноним',
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

// Получить товары магазина
app.get('/api/shop', (req, res) => {
  const data = loadData();
  const activeItems = data.shop.filter(item => item.active);
  res.json(activeItems);
});

// Покупка товара
app.post('/api/buy-item', (req, res) => {
  const { itemId, itemName, cost, userId } = req.body;
  const data = loadData();
  
  if (!data.purchases) {
    data.purchases = [];
  }
  
  data.purchases.push({
    id: Date.now(),
    itemId,
    itemName,
    cost,
    userId,
    purchasedAt: new Date().toISOString()
  });
  
  saveData(data);
  res.json({ success: true, message: 'Покупка сохранена' });
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
    lastActivity: userData.lastActivity || 'Неизвестно'
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
  
  const userInfo = {
    id: userId,
    lavki: user.lavki || 0,
    registrationDate: user.registrationDate || 'Неизвестно',
    completedTasks: user.completedTasks || 0,
    lastActivity: user.lastActivity || 'Неизвестно',
    totalSubmissions: userSubmissions.length,
    approvedSubmissions: userSubmissions.filter(s => s.status === 'approved').length,
    pendingSubmissions: userSubmissions.filter(s => s.status === 'pending').length,
    submissions: userSubmissions
  };
  
  res.json(userInfo);
});

// Обновить баланс пользователя
app.put('/api/admin/users/:userId/balance', requireAuth, (req, res) => {
  const { lavki } = req.body;
  const userId = req.params.userId;
  const data = loadData();
  
  if (!data.users[userId]) {
    data.users[userId] = { lavki: 0 };
  }
  
  data.users[userId].lavki = parseInt(lavki);
  saveData(data);
  
  res.json({ success: true, message: 'Баланс обновлен' });
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
  
  submission.status = 'approved';
  submission.reviewedAt = new Date().toISOString();
  
  const userId = submission.userId;
  if (!data.users[userId]) {
    data.users[userId] = { 
      lavki: 0,
      completedTasks: 0,
      registrationDate: new Date().toISOString()
    };
  }
  data.users[userId].lavki += submission.reward;
  data.users[userId].completedTasks = (data.users[userId].completedTasks || 0) + 1;
  data.users[userId].lastActivity = new Date().toISOString();
  
  saveData(data);
  res.json({ success: true, message: 'Задание подтверждено' });
});

// Отклонить задание
app.post('/api/admin/submissions/:id/reject', requireAuth, (req, res) => {
  const submissionId = parseInt(req.params.id);
  const data = loadData();
  
  const submission = data.submissions.find(s => s.id === submissionId);
  if (!submission) {
    return res.status(404).json({ error: 'Submission не найден' });
  }
  
  submission.status = 'rejected';
  submission.reviewedAt = new Date().toISOString();
  
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
  
  const stats = {
    totalUsers: users.length,
    activeUsers: activeUsers.length,
    totalSubmissions: data.submissions.length,
    pendingSubmissions: data.submissions.filter(s => s.status === 'pending').length,
    totalLavki: users.reduce((sum, user) => sum + (user.lavki || 0), 0),
    activeTasks: data.tasks.filter(t => t.active).length,
    activeShopItems: data.shop.filter(i => i.active).length,
    totalPurchases: (data.purchases || []).length
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
