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

// Улучшенные уведомления
function showNotification(message, type = 'info') {
  // Создаем красивый toast вместо alert
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 400px;
      animation: slideInRight 0.3s ease;
      font-weight: 600;
    ">
      ${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'} ${message}
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

// Добавим стили для анимации
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

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
        case 'purchases':
            loadPurchaseRequests();
            break;
        case 'users':
            loadUsers();
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
        const users = await apiCall('/api/admin/users');
        
        const activeUsers = users.filter(user => {
            if (!user.lastActivity) return false;
            const lastActivity = new Date(user.lastActivity);
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return lastActivity > weekAgo;
        });

        const statsHTML = `
            <div class="stat-card">
                <div class="stat-number">${stats.totalUsers}</div>
                <div class="stat-label">👥 Всего пользователей</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.activeUsers}</div>
                <div class="stat-label">🟢 Активных</div>
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
                <div class="stat-number">${stats.pendingPurchaseRequests}</div>
                <div class="stat-label">🛒 Ожидают покупки</div>
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
                            <div style="margin-top: 5px; color: #7f8c8d; font-size: 12px;">
                                Контакт: ${submission.userContact}
                            </div>
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
  if (!confirm('Подтвердить выполнение задания и начислить лавки?\n\nЭто действие нельзя отменить.')) return;
  
  try {
    showNotification('⏳ Подтверждаем задание...', 'info');
    await apiCall(`/api/admin/submissions/${submissionId}/approve`, {
      method: 'POST'
    });
    
    showNotification('✅ Задание подтверждено! Лавки начислены.');
    loadSubmissions();
    loadDashboard();
  } catch (error) {
    showNotification('❌ Ошибка подтверждения задания', 'error');
  }
}

// Отклонение задания
async function rejectSubmission(submissionId) {
  const rejectionReason = prompt('Укажите причину отклонения (например: "Попробуй ещё раз", "Фото нечеткое", "Неправильное выполнение"):', 'Попробуй ещё раз');
  
  if (rejectionReason === null) return;
  
  if (!confirm('Отклонить это задание?\n\nПользователь сможет отправить его снова.')) return;
  
  try {
    showNotification('⏳ Отклоняем задание...', 'info');
    await apiCall(`/api/admin/submissions/${submissionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason })
    });
    
    showNotification('✅ Задание отклонено. Пользователь сможет отправить его снова.');
    loadSubmissions();
  } catch (error) {
    showNotification('❌ Ошибка отклонения задания', 'error');
  }
}

// Загрузка заявок на покупку
async function loadPurchaseRequests() {
    try {
        const requests = await apiCall('/api/admin/purchase-requests');
        
        // Обновляем статистику
        document.getElementById('total-purchases').textContent = requests.length;
        document.getElementById('pending-purchases').textContent = requests.filter(r => r.status === 'pending').length;
        document.getElementById('approved-purchases').textContent = requests.filter(r => r.status === 'approved').length;
        
        if (requests.length === 0) {
            document.getElementById('purchase-requests-list').innerHTML = `
                <div class="empty-state">
                    <div>🛒</div>
                    <h3>Заявок на покупку нет</h3>
                    <p>Пользователи еще не отправляли заявки на покупку товаров</p>
                </div>
            `;
            return;
        }

        let requestsHTML = '';
        requests.forEach(request => {
            const statusBadge = request.status === 'pending' ? 
                '<span class="status-badge status-pending">⏳ Ожидает</span>' :
                request.status === 'approved' ? 
                '<span class="status-badge status-approved">✅ Подтверждено</span>' :
                '<span class="status-badge status-rejected">❌ Отклонено</span>';
            
            requestsHTML += `
                <div class="submission-item">
                    <div class="submission-header">
                        <div>
                            <div class="submission-user">👤 ${request.userName}</div>
                            <div class="submission-task">🛒 ${request.itemName}</div>
                            <div style="margin-top: 5px; color: #7f8c8d; font-size: 14px;">
                                💎 Цена: ${request.price} лавок • 
                                📅 ${new Date(request.requestedAt).toLocaleDateString('ru-RU')}
                            </div>
                            ${request.adminNotes ? `
                                <div style="margin-top: 5px; color: #666; font-size: 13px;">
                                    <strong>Заметки:</strong> ${request.adminNotes}
                                </div>
                            ` : ''}
                        </div>
                        <div>
                            ${statusBadge}
                            <div style="margin-top: 5px; color: #7f8c8d; font-size: 12px;">
                                Контакт: ${request.userContact}
                            </div>
                        </div>
                    </div>
                    
                    ${request.status === 'pending' ? `
                        <div class="submission-actions">
                            <button onclick="processPurchaseRequest(${request.id}, 'approved')" class="btn btn-approve">
                                ✅ Подтвердить покупку
                            </button>
                            <button onclick="processPurchaseRequest(${request.id}, 'rejected')" class="btn btn-reject">
                                ❌ Отклонить заявку
                            </button>
                        </div>
                    ` : `
                        <div style="color: #7f8c8d; font-size: 14px; margin-top: 10px;">
                            Обработано: ${request.processedAt ? new Date(request.processedAt).toLocaleDateString('ru-RU') : 'Неизвестно'}
                        </div>
                    `}
                </div>
            `;
        });
        
        document.getElementById('purchase-requests-list').innerHTML = requestsHTML;
    } catch (error) {
        document.getElementById('purchase-requests-list').innerHTML = '<div class="empty-state">Ошибка загрузки заявок</div>';
    }
}

// Обработка заявки на покупку
async function processPurchaseRequest(requestId, status) {
  const action = status === 'approved' ? 'подтвердить' : 'отклонить';
  const confirmMessage = status === 'approved' 
    ? 'Подтвердить покупку и списать лавки у пользователя?\n\nЭто действие нельзя отменить.'
    : 'Отклонить заявку на покупку?\n\nЛавки останутся у пользователя.';
  
  if (!confirm(confirmMessage)) return;
  
  const adminNotes = status === 'rejected' ? 
    prompt('Укажите причину отклонения (необязательно):') : null;
  
  try {
    showNotification('⏳ Обрабатываем заявку...', 'info');
    await apiCall(`/api/admin/purchase-requests/${requestId}/process`, {
      method: 'POST',
      body: JSON.stringify({ 
        status: status,
        adminNotes: adminNotes
      })
    });
    
    showNotification(`✅ Заявка ${status === 'approved' ? 'подтверждена' : 'отклонена'}!`);
    loadPurchaseRequests();
    loadDashboard();
  } catch (error) {
    showNotification('❌ Ошибка обработки заявки', 'error');
  }
}

// Загрузка списка пользователей
async function loadUsers() {
    try {
        const users = await apiCall('/api/admin/users');
        
        // Обновляем статистику
        document.getElementById('total-users').textContent = users.length;
        document.getElementById('total-lavki-users').textContent = users.reduce((sum, user) => sum + user.lavki, 0);
        
        const activeUsers = users.filter(user => {
            if (!user.lastActivity) return false;
            const lastActivity = new Date(user.lastActivity);
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return lastActivity > weekAgo;
        });
        document.getElementById('active-users').textContent = activeUsers.length;
        
        if (users.length === 0) {
            document.getElementById('users-list').innerHTML = `
                <div class="empty-state">
                    <div>👥</div>
                    <h3>Пользователей пока нет</h3>
                    <p>Как только пользователи начнут использовать приложение, они появятся здесь</p>
                </div>
            `;
            return;
        }

        let usersHTML = '';
        users.forEach(user => {
            const isActive = user.lastActivity && (new Date(user.lastActivity) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
            
            usersHTML += `
                <div class="submission-item user-item" data-user-id="${user.id}" data-user-name="${user.userName}">
                    <div class="submission-header">
                        <div>
                            <div class="submission-user">👤 ${user.userName}</div>
                            <div style="display: flex; gap: 15px; margin-top: 5px; font-size: 14px;">
                                <span>💎 ${user.lavki} лавок</span>
                                <span>✅ ${user.completedTasks || 0} заданий</span>
                                <span class="status-badge ${isActive ? 'status-approved' : 'status-rejected'}">
                                    ${isActive ? '🟢 Активен' : '⚫ Неактивен'}
                                </span>
                            </div>
                            <div style="color: #7f8c8d; font-size: 12px; margin-top: 5px;">
                                Контакт: ${user.userContact}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="color: #7f8c8d; font-size: 12px;">
                                📅 Регистрация: ${user.registrationDate ? new Date(user.registrationDate).toLocaleDateString('ru-RU') : 'Неизвестно'}
                            </div>
                            <div style="color: #7f8c8d; font-size: 12px; margin-top: 5px;">
                                📍 Последняя активность: ${user.lastActivity ? new Date(user.lastActivity).toLocaleDateString('ru-RU') : 'Неизвестно'}
                            </div>
                        </div>
                    </div>
                    
                    <div class="submission-actions">
                        <button onclick="viewUserDetails('${user.id}')" class="btn" style="background: #2196f3; color: white;">
                            📊 Детали
                        </button>
                        <button onclick="editUserBalance('${user.id}', ${user.lavki})" class="btn" style="background: #ff9800; color: white;">
                            💎 Изменить баланс
                        </button>
                        <button onclick="resetUserCharacter('${user.id}')" class="btn" style="background: #f44336; color: white;">
                            🔄 Сбросить персонажа
                        </button>
                    </div>
                </div>
            `;
        });
        
        document.getElementById('users-list').innerHTML = usersHTML;
    } catch (error) {
        document.getElementById('users-list').innerHTML = '<div class="empty-state">Ошибка загрузки пользователей</div>';
    }
}

// ДОБАВЛЕНО: Сброс персонажа пользователя
async function resetUserCharacter(userId) {
  if (!confirm(`🚨 ВНИМАНИЕ: Вы уверены, что хотите полностью сбросить персонажа пользователя?\n\nЭто действие НЕОБРАТИМО и приведет к:\n• Обнулению всех лавок\n• Сбросу прогресса заданий\n• Удалению истории покупок\n• Сбросу всей статистики`)) return;
  
  const confirmReset = prompt('Для подтверждения введите "СБРОСИТЬ" (без кавычек):');
  if (confirmReset !== 'СБРОСИТЬ') {
    showNotification('❌ Сброс отменен', 'error');
    return;
  }
  
  try {
    showNotification('⏳ Сбрасываем персонажа...', 'info');
    await apiCall(`/api/admin/users/${userId}/reset`, {
      method: 'POST'
    });
    
    showNotification('✅ Персонаж пользователя полностью сброшен!');
    loadUsers();
    loadDashboard();
  } catch (error) {
    showNotification('❌ Ошибка сброса персонажа', 'error');
  }
}

// Поиск пользователей
function filterUsers() {
    const search = document.getElementById('user-search').value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const userName = item.getAttribute('data-user-name').toLowerCase();
        if (userName.includes(search)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Просмотр деталей пользователя
async function viewUserDetails(userId) {
    try {
        const userInfo = await apiCall(`/api/admin/users/${userId}`);
        
        const submissionsHTML = userInfo.submissions.map(sub => `
            <div style="border: 1px solid #eee; padding: 10px; margin: 5px 0; border-radius: 5px;">
                <div><strong>${sub.taskName}</strong> (+${sub.reward} лавок)</div>
                <div style="font-size: 12px; color: #666;">
                    Статус: ${sub.status === 'approved' ? '✅ Подтверждено' : sub.status === 'pending' ? '⏳ Ожидает' : '❌ Отклонено'}
                    • ${new Date(sub.submittedAt).toLocaleDateString('ru-RU')}
                </div>
            </div>
        `).join('');
        
        const purchasesHTML = userInfo.purchases.map(purchase => `
            <div style="border: 1px solid #eee; padding: 10px; margin: 5px 0; border-radius: 5px;">
                <div><strong>${purchase.itemName}</strong> (${purchase.price} лавок)</div>
                <div style="font-size: 12px; color: #666;">
                    📅 ${new Date(purchase.purchasedAt).toLocaleDateString('ru-RU')}
                </div>
            </div>
        `).join('');
        
        const modalHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 10000;">
                <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
                    <h3>📊 Детали пользователя</h3>
                    <div style="margin: 20px 0;">
                        <p><strong>ID:</strong> ${userInfo.id}</p>
                        <p><strong>Имя:</strong> ${userInfo.userName}</p>
                        <p><strong>Контакт:</strong> ${userInfo.userContact}</p>
                        <p><strong>💎 Баланс:</strong> ${userInfo.lavki} лавок</p>
                        <p><strong>✅ Выполнено заданий:</strong> ${userInfo.completedTasks}</p>
                        <p><strong>📅 Дата регистрации:</strong> ${userInfo.registrationDate ? new Date(userInfo.registrationDate).toLocaleDateString('ru-RU') : 'Неизвестно'}</p>
                        <p><strong>📊 Всего отправок:</strong> ${userInfo.totalSubmissions}</p>
                        <p><strong>✅ Подтверждено:</strong> ${userInfo.approvedSubmissions}</p>
                        <p><strong>⏳ Ожидает:</strong> ${userInfo.pendingSubmissions}</p>
                        <p><strong>🛒 Покупок:</strong> ${userInfo.totalPurchases}</p>
                    </div>
                    
                    <h4>📋 История заданий:</h4>
                    <div style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">
                        ${submissionsHTML || '<p>Заданий пока нет</p>'}
                    </div>
                    
                    <h4>🛒 История покупок:</h4>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${purchasesHTML || '<p>Покупок пока нет</p>'}
                    </div>
                    
                    <div style="margin-top: 20px; text-align: center;">
                        <button onclick="closeModal()" class="btn" style="background: #666; color: white;">Закрыть</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        showNotification('Ошибка загрузки деталей пользователя', 'error');
    }
}

// Изменение баланса пользователя
async function editUserBalance(userId, currentBalance) {
  const newBalance = prompt(`Введите новый баланс для пользователя:\n\nТекущий баланс: ${currentBalance} лавок`, currentBalance);
  
  if (newBalance === null) return;
  
  const balance = parseInt(newBalance);
  if (isNaN(balance) || balance < 0) {
    showNotification('❌ Введите корректное число (0 или больше)', 'error');
    return;
  }
  
  if (!confirm(`Изменить баланс пользователя?\n\nБыло: ${currentBalance} лавок\nСтанет: ${balance} лавок`)) return;
  
  try {
    showNotification('⏳ Обновляем баланс...', 'info');
    await apiCall(`/api/admin/users/${userId}/balance`, {
      method: 'PUT',
      body: JSON.stringify({ lavki: balance })
    });
    
    showNotification('✅ Баланс пользователя обновлен!');
    loadUsers();
    loadDashboard();
  } catch (error) {
    showNotification('❌ Ошибка обновления баланса', 'error');
  }
}

// Закрытие модального окна
function closeModal() {
    const modal = document.querySelector('[style*="position: fixed; top: 0; left: 0; width: 100%"]');
    if (modal) {
        modal.remove();
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
    showNotification('❌ Заполните все поля', 'error');
    return;
  }
  
  if (!confirm(`Добавить новое задание?\n\n"${name}"\nНаграда: ${reward} лавок`)) return;
  
  try {
    showNotification('⏳ Добавляем задание...', 'info');
    await apiCall('/api/admin/tasks', {
      method: 'POST',
      body: JSON.stringify({ name, reward: parseInt(reward) })
    });
    
    showNotification('✅ Новое задание добавлено!');
    document.getElementById('new-task-name').value = '';
    document.getElementById('new-task-reward').value = '';
    loadTasks();
    loadDashboard();
  } catch (error) {
    showNotification('❌ Ошибка добавления задания', 'error');
  }
}

// Переключение активности задания
async function toggleTask(taskId, active) {
  const action = active ? 'активировать' : 'деактивировать';
  
  if (!confirm(`${active ? '✅ Активировать' : '❌ Деактивировать'} это задание?`)) return;
  
  try {
    showNotification('⏳ Обновляем задание...', 'info');
    await apiCall(`/api/admin/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ active })
    });
    
    showNotification(`✅ Задание ${active ? 'активировано' : 'деактивировано'}`);
    loadTasks();
    loadDashboard();
  } catch (error) {
    showNotification('❌ Ошибка изменения задания', 'error');
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
    showNotification('❌ Заполните все поля', 'error');
    return;
  }
  
  if (!confirm(`Добавить новый товар?\n\n"${name}"\nЦена: ${price} лавок`)) return;
  
  try {
    showNotification('⏳ Добавляем товар...', 'info');
    await apiCall('/api/admin/shop', {
      method: 'POST',
      body: JSON.stringify({ name, price: parseInt(price) })
    });
    
    showNotification('✅ Новый товар добавлен!');
    document.getElementById('new-item-name').value = '';
    document.getElementById('new-item-price').value = '';
    loadShop();
    loadDashboard();
  } catch (error) {
    showNotification('❌ Ошибка добавления товара', 'error');
  }
}

// Переключение активности товара
async function toggleShopItem(itemId, active) {
  const action = active ? 'в продажу' : 'с продажи';
  
  if (!confirm(`${active ? '✅ Вернуть в продажу' : '❌ Снять с продажи'} этот товар?`)) return;
  
  try {
    showNotification('⏳ Обновляем товар...', 'info');
    await apiCall(`/api/admin/shop/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ active })
    });
    
    showNotification(`✅ Товар ${active ? 'добавлен в продажу' : 'снят с продажи'}`);
    loadShop();
    loadDashboard();
  } catch (error) {
    showNotification('❌ Ошибка изменения товара', 'error');
  }
}

// Смена пароля
async function changePassword() {
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  
  if (!newPassword || !confirmPassword) {
    showNotification('❌ Заполните все поля', 'error');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showNotification('❌ Пароли не совпадают', 'error');
    return;
  }
  
  if (newPassword.length < 4) {
    showNotification('❌ Пароль должен быть не менее 4 символов', 'error');
    return;
  }
  
  if (!confirm('Изменить пароль администратора?\n\nЗапомните новый пароль!')) return;
  
  try {
    showNotification('⏳ Меняем пароль...', 'info');
    await apiCall('/api/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword })
    });
    
    showNotification('✅ Пароль успешно изменен!');
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
  } catch (error) {
    showNotification('❌ Ошибка смены пароля', 'error');
  }
}

// =====================
// 🔄 АВТООБНОВЛЕНИЕ ДАННЫХ
// =====================

// Автообновление данных каждые 30 секунд
function startAutoRefresh() {
  setInterval(() => {
    const activeSection = document.querySelector('.section.active');
    if (activeSection) {
      const sectionId = activeSection.id;
      
      if (sectionId === 'section-submissions') {
        loadSubmissions();
      } else if (sectionId === 'section-purchases') {
        loadPurchaseRequests();
      } else if (sectionId === 'section-dashboard') {
        loadDashboard();
      }
      // Для других разделов обновляем по необходимости
    }
  }, 30000); // 30 секунд
}

// Запускаем автообновление после загрузки
document.addEventListener('DOMContentLoaded', function() {
  const savedToken = localStorage.getItem('adminToken');
  if (savedToken) {
    authToken = savedToken;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    loadDashboard();
    startAutoRefresh(); // Запускаем автообновление
  }
});
