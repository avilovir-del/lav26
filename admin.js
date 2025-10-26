let authToken = null;
const API_BASE = window.location.origin;

// Функции для работы с API
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken,
                ...options.headers
            },
            ...options
        });

        if (response.status === 401) {
            logout();
            throw new Error('Не авторизован');
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showNotification('Ошибка соединения с сервером', 'error');
        throw error;
    }
}

// Уведомления
function showNotification(message, type = 'info') {
    if (type === 'error') {
        alert('❌ ' + message);
    } else {
        alert('✅ ' + message);
    }
}

// Авторизация
async function login() {
    const password = document.getElementById('admin-password').value;
    
    if (!password) {
        showNotification('Введите пароль', 'error');
        return;
    }

    try {
        const result = await apiCall('/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ password })
        });

        if (result.success) {
            authToken = result.token;
            localStorage.setItem('adminToken', authToken);
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('admin-panel').style.display = 'block';
            loadDashboard();
        } else {
            showNotification('Неверный пароль', 'error');
        }
    } catch (error) {
        showNotification('Ошибка авторизации', 'error');
    }
}

// Выход
function logout() {
    authToken = null;
    localStorage.removeItem('adminToken');
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('admin-password').value = '';
}

// Навигация
function showSection(sectionName) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    document.getElementById(`section-${sectionName}`).classList.add('active');
    
    document.querySelectorAll('.nav-tabs button').forEach(button => {
        button.classList.remove('active');
    });
    event.target.classList.add('active');

    switch(sectionName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'submissions':
            loadSubmissions();
            break;
        case 'tasks':
            loadTasks();
            break;
        case 'shop':
            loadShop();
            break;
    }
}

// Загрузка дашборда
async function loadDashboard() {
    try {
        const stats = await apiCall('/api/admin/stats');
        
        const statsHTML = `
            <div class="stat-card">
                <div class="stat-number">${stats.totalUsers}</div>
                <div class="stat-label">👥 Пользователей</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.totalSubmissions}</div>
                <div class="stat-label">📸 Всего заданий</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.pendingSubmissions}</div>
                <div class="stat-label">⏳ Ожидают проверки</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.totalLavki}</div>
                <div class="stat-label">💎 Всего лавок</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.activeTasks}</div>
                <div class="stat-label">📋 Активных заданий</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.activeShopItems}</div>
                <div class="stat-label">🛍️ Товаров в магазине</div>
            </div>
        `;
        
        document.getElementById('stats-grid').innerHTML = statsHTML;
    } catch (error) {
        document.getElementById('stats-grid').innerHTML = '<div class="empty-state">Ошибка загрузки статистики</div>';
    }
}

// Загрузка заданий на проверку
async function loadSubmissions() {
    try {
        const submissions = await apiCall('/api/admin/submissions');
        const pendingSubmissions = submissions.filter(s => s.status === 'pending');
        
        if (pendingSubmissions.length === 0) {
            document.getElementById('submissions-list').innerHTML = `
                <div class="empty-state">
                    <div>🎉</div>
                    <h3>Нет заданий на проверку</h3>
                    <p>Все задания проверены!</p>
                </div>
            `;
            return;
        }

        let submissionsHTML = '';
        pendingSubmissions.forEach(submission => {
            submissionsHTML += `
                <div class="submission-item">
                    <div class="submission-header">
                        <div>
                            <div class="submission-user">👤 ${submission.userName}</div>
                            <div class="submission-task">📋 ${submission.taskName}</div>
                        </div>
                        <div>
                            <span class="status-badge status-pending">⏳ Ожидает</span>
                            <div style="margin-top: 5px; color: #7f8c8d; font-size: 12px;">
                                💎 +${submission.reward} лавок
                            </div>
                        </div>
                    </div>
                    
                    <img src="${submission.photo}" alt="Фото задания" class="submission-photo" 
                         onerror="this.src='https://via.placeholder.com/300x200/ECF0F1/666?text=Ошибка+загрузки+фото'">
                    
                    <div class="submission-actions">
                        <button onclick="approveSubmission(${submission.id})" class="btn btn-approve">
                            ✅ Подтвердить (+${submission.reward} лавок)
                        </button>
                        <button onclick="rejectSubmission(${submission.id})" class="btn btn-reject">
                            ❌ Отклонить
                        </button>
                    </div>
                </div>
            `;
        });
        
        document.getElementById('submissions-list').innerHTML = submissionsHTML;
    } catch (error) {
        document.getElementById('submissions-list').innerHTML = '<div class="empty-state">Ошибка загрузки заданий</div>';
    }
}

// Подтверждение задания
async function approveSubmission(submissionId) {
    if (!confirm('Подтвердить выполнение задания и начислить лавки?')) return;
    
    try {
        await apiCall(`/api/admin/submissions/${submissionId}/approve`, {
            method: 'POST'
        });
        
        showNotification('Задание подтверждено! Лавки начислены.');
        loadSubmissions();
        loadDashboard();
    } catch (error) {
        showNotification('Ошибка подтверждения задания', 'error');
    }
}

// Отклонение задания
async function rejectSubmission(submissionId) {
    if (!confirm('Отклонить это задание?')) return;
    
    try {
        await apiCall(`/api/admin/submissions/${submissionId}/reject`, {
            method: 'POST'
        });
        
        showNotification('Задание отклонено.');
        loadSubmissions();
    } catch (error) {
        showNotification('Ошибка отклонения задания', 'error');
    }
}

// Загрузка списка заданий
async function loadTasks() {
    try {
        const tasks = await apiCall('/api/admin/tasks');
        
        let tasksHTML = '';
        tasks.forEach(task => {
            tasksHTML += `
                <div class="submission-item">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4>${task.name}</h4>
                            <p>💎 Награда: ${task.reward} лавок</p>
                            <span class="status-badge ${task.active ? 'status-approved' : 'status-rejected'}">
                                ${task.active ? '✅ Активно' : '❌ Неактивно'}
                            </span>
                        </div>
                        <div>
                            <button onclick="toggleTask(${task.id}, ${!task.active})" class="btn" 
                                    style="background: ${task.active ? '#ff9800' : '#4caf50'}; color: white; margin: 2px;">
                                ${task.active ? '❌ Деактивировать' : '✅ Активировать'}
                            </button>
                            <button onclick="editTask(${task.id})" class="btn" style="background: #2196f3; color: white; margin: 2px;">
                                ✏️ Редактировать
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        document.getElementById('tasks-list').innerHTML = tasksHTML;
    } catch (error) {
        document.getElementById('tasks-list').innerHTML = '<div class="empty-state">Ошибка загрузки заданий</div>';
    }
}

// Добавление нового задания
async function addNewTask() {
    const name = document.getElementById('new-task-name').value;
    const reward = document.getElementById('new-task-reward').value;
    
    if (!name || !reward) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    try {
        await apiCall('/api/admin/tasks', {
            method: 'POST',
            body: JSON.stringify({ name, reward: parseInt(reward) })
        });
        
        showNotification('Новое задание добавлено!');
        document.getElementById('new-task-name').value = '';
        document.getElementById('new-task-reward').value = '';
        loadTasks();
        loadDashboard();
    } catch (error) {
        showNotification('Ошибка добавления задания', 'error');
    }
}

// Переключение активности задания
async function toggleTask(taskId, active) {
    try {
        await apiCall(`/api/admin/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify({ active })
        });
        
        showNotification(`Задание ${active ? 'активировано' : 'деактивировано'}`);
        loadTasks();
    } catch (error) {
        showNotification('Ошибка изменения задания', 'error');
    }
}

// Загрузка магазина
async function loadShop() {
    try {
        const shopItems = await apiCall('/api/admin/shop');
        
        let shopHTML = '';
        shopItems.forEach(item => {
            shopHTML += `
                <div class="submission-item">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4>${item.name}</h4>
                            <p>💎 Цена: ${item.price} лавок</p>
                            <span class="status-badge ${item.active ? 'status-approved' : 'status-rejected'}">
                                ${item.active ? '✅ В продаже' : '❌ Не продается'}
                            </span>
                        </div>
                        <div>
                            <button onclick="toggleShopItem(${item.id}, ${!item.active})" class="btn" 
                                    style="background: ${item.active ? '#ff9800' : '#4caf50'}; color: white; margin: 2px;">
                                ${item.active ? '❌ Снять с продажи' : '✅ Вернуть в продажу'}
                            </button>
                            <button onclick="editShopItem(${item.id})" class="btn" style="background: #2196f3; color: white; margin: 2px;">
                                ✏️ Редактировать
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        document.getElementById('shop-list').innerHTML = shopHTML;
    } catch (error) {
        document.getElementById('shop-list').innerHTML = '<div class="empty-state">Ошибка загрузки магазина</div>';
    }
}

// Добавление нового товара
async function addNewShopItem() {
    const name = document.getElementById('new-item-name').value;
    const price = document.getElementById('new-item-price').value;
    
    if (!name || !price) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    try {
        await apiCall('/api/admin/shop', {
            method: 'POST',
            body: JSON.stringify({ name, price: parseInt(price) })
        });
        
        showNotification('Новый товар добавлен!');
        document.getElementById('new-item-name').value = '';
        document.getElementById('new-item-price').value = '';
        loadShop();
        loadDashboard();
    } catch (error) {
        showNotification('Ошибка добавления товара', 'error');
    }
}

// Переключение активности товара
async function toggleShopItem(itemId, active) {
    try {
        await apiCall(`/api/admin/shop/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({ active })
        });
        
        showNotification(`Товар ${active ? 'добавлен в продажу' : 'снят с продажи'}`);
        loadShop();
    } catch (error) {
        showNotification('Ошибка изменения товара', 'error');
    }
}

// Смена пароля
async function changePassword() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (!newPassword || !confirmPassword) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    
    if (newPassword.length < 4) {
        showNotification('Пароль должен быть не менее 4 символов', 'error');
        return;
    }
    
    try {
        await apiCall('/api/admin/change-password', {
            method: 'POST',
            body: JSON.stringify({ newPassword })
        });
        
        showNotification('Пароль успешно изменен!');
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
    } catch (error) {
        showNotification('Ошибка смены пароля', 'error');
    }
}

// Функции редактирования (заглушки)
function editTask(taskId) {
    showNotification('Функция редактирования в разработке');
}

function editShopItem(itemId) {
    showNotification('Функция редактирования в разработке');
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
        authToken = savedToken;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        loadDashboard();
    }
});