// =====================
// 🌐 НАСТРОЙКИ СЕРВЕРА
// =====================
const API_BASE = window.location.origin;

// =====================
// 💎 ЛАВКИ - ТЕПЕРЬ ГРУЗИМ С СЕРВЕРА
// =====================
let lavki = 0;

// =====================
// 💾 СИСТЕМА СОХРАНЕНИЯ ПОЛНОГО СОСТОЯНИЯ
// =====================

// Сохранить все данные пользователя на сервер
async function saveFullUserState() {
  try {
    const userInfo = getUserInfo();
    
    // Подготавливаем полное состояние
    const fullState = {
      lavki: lavki,
      settings: {
        charName: localStorage.getItem('charName') || 'Лавчик',
        characterImg: localStorage.getItem('characterImg') || 'images/1.png'
      },
      lastSave: new Date().toISOString()
    };
    
    const response = await fetch(`${API_BASE}/api/user/${userInfo.id}/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: fullState })
    });

    if (response.ok) {
      console.log('💾 Полное состояние сохранено на сервер');
    }
  } catch (error) {
    console.log('❌ Ошибка сохранения полного состояния:', error);
  }
}

// Загрузить все данные пользователя с сервера
async function loadFullUserState() {
  try {
    const userInfo = getUserInfo();
    const response = await fetch(`${API_BASE}/api/user/${userInfo.id}/state`);
    
    if (response.ok) {
      const userData = await response.json();
      
      // Восстанавливаем лавки
      lavki = userData.lavki || 0;
      
      // Восстанавливаем настройки
      if (userData.settings) {
        if (userData.settings.charName) {
          localStorage.setItem('charName', userData.settings.charName);
        }
        if (userData.settings.characterImg) {
          localStorage.setItem('characterImg', userData.settings.characterImg);
        }
      }
      
      updateLavki();
      updateCharacterDisplay();
      
      console.log('🔄 Полное состояние загружено с сервера');
      return true;
    }
  } catch (error) {
    console.log('❌ Ошибка загрузки полного состояния:', error);
  }
  
  return false;
}

// Функция для загрузки данных пользователя
async function loadUserData() {
    try {
        const userInfo = getUserInfo();
        const response = await fetch(`${API_BASE}/api/user/${userInfo.id}/data`);
        if (response.ok) {
            const userData = await response.json();
            lavki = userData.lavki || 0;
            
            // Загружаем локальные настройки из серверных данных
            if (userData.settings) {
                if (userData.settings.charName) {
                    localStorage.setItem('charName', userData.settings.charName);
                }
                if (userData.settings.characterImg) {
                    localStorage.setItem('characterImg', userData.settings.characterImg);
                }
            }
            
            updateLavki();
            updateCharacterDisplay();
            console.log('👤 Данные пользователя загружены с сервера');
        }
    } catch (error) {
        console.log('❌ Ошибка загрузки данных пользователя, используем локальные данные:', error);
        // Fallback: загружаем из localStorage
        lavki = parseInt(localStorage.getItem('lavki')) || 0;
        updateLavki();
    }
}

// =====================
// 🌟 НАВИГАЦИЯ
// =====================
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });

  const screen = document.getElementById(`screen-${name}`);
  if (screen) {
    screen.classList.add('active');
    
    if (name === 'character') {
      setTimeout(liftCharacterImage, 50);
    } else if (name === 'tasks') {
      // ПРОВЕРЯЕМ при открытии экрана заданий
      setTimeout(checkApprovedTasks, 500);
      setTimeout(checkRejectedTasks, 500);
      setTimeout(loadTasksFromServer, 500);
    } else if (name === 'shop') {
      setTimeout(() => {
        loadShopItems();
      }, 100);
    } else if (name === 'settings') {
      setTimeout(() => {
        loadUserPurchases();
      }, 100);
    }
    
    setTimeout(() => {
      updateStats();
      if (name === 'character') {
        updateCharacterDisplay();
      }
    }, 50);
  }
}

// =====================
// 💎 ЛАВКИ
// =====================

function updateLavki() {
  const lavkiAmount = document.getElementById('lavki-amount');
  if (lavkiAmount) {
    lavkiAmount.textContent = lavki;
  }
  
  // Автоматически сохраняем полное состояние при изменении лавок
  saveFullUserState().catch(error => {
    console.log('❌ Ошибка автосохранения:', error);
  });
  
  // Сохраняем локально как fallback
  localStorage.setItem('lavki', lavki);
}

// =====================
// 🛍️ ОБНОВЛЕННАЯ СИСТЕМА ПОКУПОК
// =====================

async function loadShopItems() {
  try {
    const response = await fetch(`${API_BASE}/api/shop`);
    if (response.ok) {
      const shopItems = await response.json();
      updateShopDisplay(shopItems);
      localStorage.setItem('shopItems', JSON.stringify(shopItems));
    }
  } catch (error) {
    console.log('❌ Не удалось загрузить товары, используем локальные:', error);
    const savedItems = localStorage.getItem('shopItems');
    if (savedItems) {
      updateShopDisplay(JSON.parse(savedItems));
    }
  }
}

function updateShopDisplay(shopItems) {
  const shopContainer = document.getElementById('shop-items');
  if (!shopContainer) return;
  
  let shopHTML = '';
  
  const activeItems = shopItems.filter(item => item.active);
  if (activeItems.length === 0) {
    shopHTML = `
      <div class="shop">
        <div style="text-align: center; color: #666; padding: 20px;">
          🏪 Магазин пуст
          <br>
          <small>Товары появятся позже</small>
        </div>
      </div>
    `;
  } else {
    activeItems.forEach(item => {
      shopHTML += `
        <div class="shop">
          <div>${item.name} — ${item.price} лавок</div>
          <button onclick="buyItem('${item.name}', ${item.price}, ${item.id})">Купить</button>
        </div>
      `;
    });
  }
  
  shopContainer.innerHTML = shopHTML;
}

// =====================
// 👤 УЛУЧШЕННАЯ ИДЕНТИФИКАЦИЯ ПОЛЬЗОВАТЕЛЕЙ
// =====================

// Функция для получения информации о пользователе
function getUserInfo() {
  const tg = window.Telegram?.WebApp;
  if (tg && tg.initDataUnsafe?.user) {
    const user = tg.initDataUnsafe.user;
    return {
      id: user.id.toString(),
      firstName: user.first_name || 'Неизвестный',
      lastName: user.last_name || '',
      username: user.username ? `@${user.username}` : 'Не указан',
      language: user.language_code || 'ru',
      fullName: [user.first_name, user.last_name].filter(Boolean).join(' '),
      contact: user.username ? `@${user.username}` : `ID: ${user.id}`
    };
  }
  return {
    id: `user_${Date.now()}`,
    firstName: 'Аноним',
    username: 'Не указан',
    fullName: 'Анонимный пользователь',
    contact: 'Не указан'
  };
}

// Инициализация пользователя при входе
async function initializeUser() {
  try {
    const userInfo = getUserInfo();
    const response = await fetch(`${API_BASE}/api/initialize-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userInfo.id,
        userName: userInfo.fullName,
        userContact: userInfo.contact
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('👤 Пользователь инициализирован');
      
      // Загружаем актуальный баланс с сервера
      const balanceResponse = await fetch(`${API_BASE}/api/user/${userInfo.id}/balance`);
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        lavki = balanceData.lavki;
        updateLavki();
      }
    }
  } catch (error) {
    console.log('❌ Ошибка инициализации пользователя:', error);
  }
}

async function buyItem(itemName, cost, itemId) {
  if (lavki >= cost) {
    const userInfo = getUserInfo();
    
    if (confirm(`Отправить заявку на покупку "${itemName}" за ${cost} лавок?`)) {
      try {
        const response = await fetch(`${API_BASE}/api/buy-item`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: itemId,
            itemName: itemName,
            price: cost,
            userId: userInfo.id,
            userName: userInfo.fullName,
            userContact: userInfo.contact
          })
        });

        if (response.ok) {
          lavki -= cost;
          updateLavki();
          
          showNotification(`✅ Заявка на покупку "${itemName}" отправлена! Ожидайте подтверждения.`, 'success');
        } else {
          throw new Error('Ошибка сервера');
        }
      } catch (error) {
        lavki += cost;
        updateLavki();
        showNotification('❌ Ошибка отправки заявки', 'error');
      }
    }
  } else {
    showNotification('Недостаточно лавок 💎', 'error');
  }
}

function refreshShop() {
  showNotification('🔄 Обновляем магазин...', 'info');
  loadShopItems();
}

// =====================
// 🛒 БЛОК ПОКУПОК ПОЛЬЗОВАТЕЛЯ
// =====================

async function loadUserPurchases() {
  try {
    const userInfo = getUserInfo();
    const response = await fetch(`${API_BASE}/api/user/${userInfo.id}/purchases`);
    
    if (response.ok) {
      const purchases = await response.json();
      updatePurchasesDisplay(purchases);
    }
  } catch (error) {
    console.log('❌ Ошибка загрузки покупок:', error);
    document.getElementById('user-purchases-list').innerHTML = `
      <div style="text-align: center; color: #666; padding: 20px;">
        ❌ Ошибка загрузки покупок
      </div>
    `;
  }
}

function updatePurchasesDisplay(purchases) {
  const purchasesContainer = document.getElementById('user-purchases-list');
  if (!purchasesContainer) return;
  
  if (purchases.length === 0) {
    purchasesContainer.innerHTML = `
      <div style="text-align: center; color: #666; padding: 20px;">
        🛒 Покупок пока нет
        <br>
        <small>Купите что-нибудь в магазине!</small>
      </div>
    `;
    return;
  }
  
  let purchasesHTML = '';
  purchases.forEach(purchase => {
    purchasesHTML += `
      <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 10px; border-left: 4px solid #4caf50;">
        <div style="font-weight: bold; margin-bottom: 5px;">${purchase.itemName}</div>
        <div style="color: #666; font-size: 14px;">
          💎 ${purchase.price} лавок • 
          📅 ${new Date(purchase.purchasedAt).toLocaleDateString('ru-RU')}
        </div>
      </div>
    `;
  });
  
  purchasesContainer.innerHTML = purchasesHTML;
}

// =====================
// ⚙️ ОБНОВЛЕННАЯ СИСТЕМА НАСТРОЕК
// =====================

async function saveSettings() {
  const nameInput = document.getElementById('char-name');
  const name = nameInput ? nameInput.value.trim() : '';
  
  if (!name) {
    alert('⚠️ Пожалуйста, введите имя персонажа');
    nameInput.focus();
    return;
  }
  
  if (name.length < 2) {
    alert('⚠️ Имя должно содержать хотя бы 2 символа');
    return;
  }
  
  try {
    const userInfo = getUserInfo();
    const response = await fetch(`${API_BASE}/api/user/${userInfo.id}/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        settings: {
          charName: name,
          characterImg: localStorage.getItem('characterImg') || 'images/1.png'
        }
      })
    });

    if (response.ok) {
      localStorage.setItem('charName', name);
      updateCharacterDisplay();
      showSuccessMessage('Имя персонажа сохранено на сервере! 🎉');
    } else {
      throw new Error('Ошибка сервера');
    }
  } catch (error) {
    console.log('❌ Ошибка сохранения настроек, сохраняем локально:', error);
    localStorage.setItem('charName', name);
    updateCharacterDisplay();
    showSuccessMessage('Имя персонажа сохранено (оффлайн режим)! 🎉');
  }
}

function updateCharacterDisplay() {
  const name = localStorage.getItem('charName') || 'Лавчик';
  const nameDisplay = document.getElementById('character-name-display');
  const statusDisplay = document.getElementById('character-status');
  
  if (nameDisplay) {
    nameDisplay.textContent = name;
  }
  
  if (statusDisplay) {
    const statuses = [
      'Счастлив и готов к приключениям! 😄',
      'Рад видеть вас! ✨',
      'Готов к новым заданиям! 🚀',
      'Настроен позитивно! 🌟'
    ];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    statusDisplay.textContent = randomStatus;
  }
}

function loadCharacterName() {
  const savedName = localStorage.getItem('charName');
  const nameInput = document.getElementById('char-name');
  
  if (savedName && nameInput) {
    nameInput.value = savedName;
  } else {
    nameInput.value = 'Лавчик';
  }
  updateCharacterDisplay();
}

function initializeCharacterSelector() {
  const selector = document.getElementById('character-selector');
  const currentCharacter = localStorage.getItem('characterImg') || 'images/1.png';
  
  if (selector) {
    const options = selector.querySelectorAll('.character-option');
    options.forEach(option => {
      const imgPath = option.getAttribute('data-img');
      option.addEventListener('click', () => changeCharacter(imgPath));
      
      if (imgPath === currentCharacter) {
        option.classList.add('selected');
      }
    });
  }
}

async function changeCharacter(imgPath) {
  const img = document.getElementById('character-img');
  if (img) {
    img.src = imgPath;
    
    try {
      const userInfo = getUserInfo();
      const response = await fetch(`${API_BASE}/api/user/${userInfo.id}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: {
            characterImg: imgPath,
            charName: localStorage.getItem('charName') || 'Лавчик'
          }
        })
      });

      if (!response.ok) {
        throw new Error('Ошибка сервера');
      }
    } catch (error) {
      console.log('❌ Ошибка сохранения внешности, сохраняем локально:', error);
    }
    
    localStorage.setItem('characterImg', imgPath);
    
    const options = document.querySelectorAll('.character-option');
    options.forEach(option => {
      option.classList.remove('selected');
      if (option.getAttribute('data-img') === imgPath) {
        option.classList.add('selected');
      }
    });
    
    showSuccessMessage('Внешность персонажа изменена! 👗');
  }
}

function loadCharacter() {
  const savedImg = localStorage.getItem('characterImg');
  const characterImg = document.getElementById('character-img');
  if (savedImg && characterImg) {
    characterImg.src = savedImg;
  }
}

function updateStats() {
  const totalLavki = document.getElementById('total-lavki');
  const completedTasks = document.getElementById('completed-tasks');
  const creationDate = document.getElementById('creation-date');
  
  if (totalLavki) {
    totalLavki.textContent = lavki;
  }
  
  if (completedTasks) {
    const completedCount = tasks.filter(task => task.userCompleted).length;
    completedTasks.textContent = `${completedCount} из ${tasks.length}`;
  }
  
  if (creationDate) {
    let creation = localStorage.getItem('creationDate');
    if (!creation) {
      creation = new Date().toLocaleDateString('ru-RU');
      localStorage.setItem('creationDate', creation);
    }
    creationDate.textContent = creation;
  }
}

function showSuccessMessage(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #4caf50;
    color: white;
    padding: 12px 20px;
    border-radius: 25px;
    font-weight: 600;
    z-index: 1000;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 2000);
}

// =====================
// 📋 ОПТИМИЗИРОВАННАЯ СИСТЕМА ЗАДАНИЙ
// =====================

let tasks = [];

// Загрузка заданий с сервера с информацией о выполнении
async function loadTasksFromServer() {
  try {
    const userInfo = getUserInfo();
    const response = await fetch(`${API_BASE}/api/tasks/${userInfo.id}`);
    
    if (response.ok) {
      const serverTasks = await response.json();
      tasks = serverTasks;
      renderTasks();
      console.log('📋 Задания синхронизированы с сервером');
    }
  } catch (error) {
    console.log('❌ Ошибка загрузки заданий с сервера:', error);
    // Используем локальные данные как fallback
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      try {
        tasks = JSON.parse(savedTasks);
        renderTasks();
      } catch (e) {
        console.error('❌ Ошибка загрузки локальных заданий:', e);
      }
    }
  }
}

function initializeTasks() {
  // Сразу загружаем с сервера
  loadTasksFromServer();
}

// Оптимизированный рендер заданий
function renderTasks() {
  const list = document.getElementById('task-list');
  if (!list) {
    console.error('❌ Элемент task-list не найден');
    return;
  }

  // Быстрая очистка
  list.innerHTML = '';

  const activeTasks = tasks.filter(task => task.active);
  
  if (activeTasks.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; color: #666; padding: 40px;">
        📝 Заданий пока нет
        <br>
        <small>Администратор добавит задания позже</small>
      </div>
    `;
    return;
  }

  // Используем DocumentFragment для быстрого добавления
  const fragment = document.createDocumentFragment();

  activeTasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = 'task-item';
    
    // Устанавливаем стили в зависимости от статуса
    if (task.userCompleted) {
      li.style.background = '#f8fff8';
      li.style.borderLeft = '4px solid #4caf50';
    } else if (task.pendingApproval) {
      li.style.background = '#fff3cd';
      li.style.borderLeft = '4px solid #ff9800';
    } else {
      li.style.background = 'white';
      li.style.borderLeft = '4px solid #3498db';
    }

    const divName = document.createElement('div');
    divName.style.fontWeight = 'bold';
    divName.style.marginBottom = '10px';
    
    if (task.userCompleted) {
      divName.innerHTML = `✅ <s>${task.name}</s>`;
    } else if (task.pendingApproval) {
      divName.innerHTML = `⏳ ${task.name} (на проверке)`;
    } else {
      divName.innerHTML = `📝 ${task.name}`;
    }
    
    li.appendChild(divName);

    const btnContainer = document.createElement('div');
    btnContainer.className = 'task-buttons';

    if (!task.userCompleted && !task.pendingApproval && task.canSubmit) {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      fileInput.id = `file-input-${task.id}`;
      
      fileInput.addEventListener('change', function(e) {
        handleImageUpload(e, task.id);
      });

      const uploadBtn = document.createElement('button');
      uploadBtn.className = 'complete';
      uploadBtn.textContent = `Прикрепить фото (+${task.reward} лавок)`;
      
      uploadBtn.onclick = () => {
        fileInput.click();
      };

      btnContainer.appendChild(fileInput);
      btnContainer.appendChild(uploadBtn);
    } else if (task.pendingApproval) {
      const pendingText = document.createElement('span');
      pendingText.textContent = '⏳ Ожидает проверки';
      pendingText.style.color = '#ff9800';
      pendingText.style.fontWeight = 'bold';
      btnContainer.appendChild(pendingText);
    } else if (task.userCompleted) {
      const completedText = document.createElement('span');
      completedText.textContent = '✅ Выполнено';
      completedText.style.color = '#4caf50';
      completedText.style.fontWeight = 'bold';
      btnContainer.appendChild(completedText);
    } else {
      const cannotSubmitText = document.createElement('span');
      cannotSubmitText.textContent = '❌ Недоступно';
      cannotSubmitText.style.color = '#f44336';
      cannotSubmitText.style.fontWeight = 'bold';
      btnContainer.appendChild(cannotSubmitText);
    }

    li.appendChild(btnContainer);
    fragment.appendChild(li);
  });
  
  list.appendChild(fragment);
  updateStats();
}

// Обработка загрузки фото
function handleImageUpload(event, taskId) {
  const file = event.target.files[0];
  if (!file) {
    console.log('Файл не выбран');
    return;
  }

  if (!file.type.match('image.*')) {
    alert('Пожалуйста, выберите файл изображения');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('Файл слишком большой. Максимальный размер: 5MB');
    return;
  }

  const reader = new FileReader();
  
  reader.onload = function(e) {
    const imageDataUrl = e.target.result;
    completeTaskWithPhoto(taskId, imageDataUrl);
  };
  
  reader.onerror = function() {
    console.error('❌ Ошибка при чтении файла');
    alert('Ошибка при чтении файла');
  };
  
  reader.readAsDataURL(file);
}

// Отправка задания на проверку
async function completeTaskWithPhoto(taskId, photoDataUrl) {
  try {
    const userInfo = getUserInfo();
    
    const response = await fetch(`${API_BASE}/api/submit-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId: taskId,
        photo: photoDataUrl,
        userId: userInfo.id,
        userName: userInfo.fullName,
        userContact: userInfo.contact
      })
    });

    if (response.ok) {
      showNotification('📸 Фото отправлено на проверку! Ожидайте начисления лавок.', 'success');
      
      // Обновляем локальный статус задания
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        tasks[taskIndex].pendingApproval = true;
        tasks[taskIndex].canSubmit = false;
        renderTasks();
      }
      
    } else {
      const errorData = await response.json();
      showNotification(`❌ ${errorData.error}`, 'error');
    }
  } catch (error) {
    console.log('❌ Сервер недоступен:', error);
    showNotification('❌ Ошибка соединения с сервером', 'error');
  }
}

// =====================
// 🔄 ПРОВЕРКА ПОДТВЕРЖДЕННЫХ ЗАДАНИЙ
// =====================

async function checkApprovedTasks() {
  try {
    const userInfo = getUserInfo();
    const userId = userInfo.id;
    
    if (!userId) return;

    const response = await fetch(`${API_BASE}/api/user/${userId}/approved-tasks`);
    if (response.ok) {
      const approvedTasks = await response.json();
      
      if (approvedTasks.length > 0) {
        approvedTasks.forEach(task => {
          // Находим задание в локальном списке
          const taskIndex = tasks.findIndex(t => t.id === task.taskId);
          if (taskIndex !== -1 && !tasks[taskIndex].userCompleted) {
            // Начисляем лавки
            lavki += tasks[taskIndex].reward;
            tasks[taskIndex].userCompleted = true;
            tasks[taskIndex].pendingApproval = false;
            tasks[taskIndex].canSubmit = false;
            
            // Показываем уведомление
            showNotification(`🎉 Задание "${tasks[taskIndex].name}" подтверждено! Получено ${tasks[taskIndex].reward} лавок`, 'success');
            animateCharacterReward();
          }
        });
        
        updateLavki();
        renderTasks();
      }
    }
  } catch (error) {
    console.log('❌ Ошибка проверки подтвержденных заданий:', error);
  }
}

// Проверка отклоненных заданий
async function checkRejectedTasks() {
  try {
    const userInfo = getUserInfo();
    const userId = userInfo.id;
    
    if (!userId) return;

    const response = await fetch(`${API_BASE}/api/user/${userId}/rejected-tasks`);
    if (response.ok) {
      const rejectedTasks = await response.json();
      
      if (rejectedTasks.length > 0) {
        rejectedTasks.forEach(task => {
          // Находим задание в локальном списке и сбрасываем статус
          const taskIndex = tasks.findIndex(t => t.id === task.taskId);
          if (taskIndex !== -1) {
            tasks[taskIndex].pendingApproval = false;
            tasks[taskIndex].canSubmit = true;
            
            // Показываем уведомление с причиной отклонения
            showNotification(`❌ Задание "${tasks[taskIndex].name}" отклонено: ${task.rejectionReason}`, 'error');
          }
        });
        
        renderTasks();
      }
    }
  } catch (error) {
    console.log('❌ Ошибка проверки отклоненных заданий:', error);
  }
}

// Периодическая синхронизация заданий
function startTasksSync() {
  setInterval(() => {
    loadTasksFromServer();
  }, 30000);
}

// Периодическая проверка каждые 30 секунд
function startTaskChecking() {
  setInterval(() => {
    checkApprovedTasks();
    checkRejectedTasks();
  }, 30000);
}

// =====================
// АНИМАЦИЯ ПЕРСОНАЖА
// =====================
function animateCharacterReward() {
  const img = document.getElementById('character-img');
  if (img) {
    img.classList.add('bounce');
    setTimeout(() => img.classList.remove('bounce'), 1000);
  }
}

// =====================
// 🎯 ИСПРАВЛЕНИЯ ОТОБРАЖЕНИЯ
// =====================

function initializeDisplayValues() {
  updateLavki();
  updateCharacterDisplay();
  updateStats();
  
  const foodElement = document.getElementById('food');
  const energyElement = document.getElementById('energy');
  const funElement = document.getElementById('fun');
  
  if (foodElement && !foodElement.textContent) foodElement.textContent = '80';
  if (energyElement && !energyElement.textContent) energyElement.textContent = '60';
  if (funElement && !funElement.textContent) funElement.textContent = '40';
}

function checkImages() {
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.onerror = function() {
      console.log('❌ Ошибка загрузки изображения:', this.src);
      this.src = 'https://via.placeholder.com/200x200/ECF0F1/666?text=🎮';
    };
  });
}

function liftCharacterImage() {
  const characterScreen = document.getElementById('screen-character');
  const characterImg = document.getElementById('character-img');
  const characterHeader = document.querySelector('.character-header');
  
  if (characterScreen && characterImg && characterHeader) {
    characterHeader.style.marginBottom = '0px';
    characterHeader.style.paddingBottom = '0px';
    
    const screenHeight = window.innerHeight;
    const navHeight = 60;
    const headerHeight = characterHeader.offsetHeight;
    const needsHeight = characterScreen.querySelector('.needs-overlay').offsetHeight;
    
    const availableHeight = screenHeight - navHeight - headerHeight - needsHeight - 10;
    
    characterImg.style.maxHeight = `${Math.max(250, availableHeight)}px`;
    
    characterScreen.style.gap = '0';
    characterScreen.style.rowGap = '0';
  }
}

// =====================
// 🔄 ИНИЦИАЛИЗАЦИЯ С СЕРВЕРОМ
// =====================

async function initializeWithServer() {
  try {
    await loadTasksFromServer();
    await loadShopItems();
  } catch (error) {
    console.log('❌ Сервер недоступен, работаем в оффлайн режиме:', error);
  }
}

// =====================
// 🔔 СИСТЕМА УВЕДОМЛЕНИЙ
// =====================

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
    color: white;
    padding: 12px 24px;
    border-radius: 25px;
    font-weight: 600;
    z-index: 10000;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 90%;
    text-align: center;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// =====================
// 💾 РУЧНОЕ УПРАВЛЕНИЕ СОХРАНЕНИЕМ
// =====================

// Принудительное сохранение
async function forceSave() {
  showNotification('💾 Сохраняем данные...', 'info');
  await saveFullUserState();
  showNotification('✅ Все данные сохранены!', 'success');
}

// Принудительная загрузка
async function loadFromServer() {
  showNotification('🔄 Загружаем данные...', 'info');
  const success = await loadFullUserState();
  if (success) {
    showNotification('✅ Данные загружены с сервера!', 'success');
  } else {
    showNotification('❌ Ошибка загрузки данных', 'error');
  }
}

// Сделайте функции глобальными
window.forceSave = forceSave;
window.loadFromServer = loadFromServer;

// =====================
// 🚀 ОПТИМИЗИРОВАННАЯ ИНИЦИАЛИЗАЦИЯ
// =====================

document.addEventListener('DOMContentLoaded', () => {
  // Быстрая инициализация навигации
  const navButtons = document.querySelectorAll('.nav button');
  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.target;
      showScreen(target);

      navButtons.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
    });
  });

  showScreen('character');
  if (navButtons[0]) navButtons[0].classList.add('active');

  // Параллельная инициализация для скорости
  Promise.all([
    // Быстрые операции
    loadCharacter(),
    loadCharacterName(),
    initializeCharacterSelector(),
    initializeDisplayValues(),
    checkImages()
  ]).then(() => {
    // Затем загружаем данные с сервера
    setTimeout(() => {
      loadFullUserState().then(success => {
        if (!success) {
          lavki = parseInt(localStorage.getItem('lavki')) || 0;
          initializeTasks();
          updateLavki();
        }
        
        initializeUser();
        initializeWithServer();
      });
    }, 100);
  });

  // Оптимизированные таймеры
  setTimeout(() => {
    startTaskChecking();
    startTasksSync();
    setTimeout(checkApprovedTasks, 2000);
    setTimeout(checkRejectedTasks, 2000);
  }, 3000);

  // Автосохранение с дебаунсингом
  let saveTimeout;
  const scheduleSave = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveFullUserState, 2000);
  };

  // Сохраняем при закрытии/обновлении страницы
  window.addEventListener('beforeunload', scheduleSave);
});

// Оптимизированный ресайз
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(liftCharacterImage, 100);
});

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(liftCharacterImage, 100);
});

// Добавляем анимацию для уведомлений
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  
  @keyframes slideOut {
    from { opacity: 1; transform: translateX(-50%) translateY(0); }
    to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
  }
`;
document.head.appendChild(style);
