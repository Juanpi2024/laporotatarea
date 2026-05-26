/**
 * ============================================================================
 * LA POROTA: MISIÓN EN LA CIUDAD DE LOS MUÑECOS
 * ============================================================================
 * Aplicación educativa gamificada basada en el libro "La Porota"
 * de Hernán del Solar. Dirigida a estudiantes de 3° a 4° básico.
 *
 * Los estudiantes responden preguntas de comprensión lectora para
 * avanzar por un mapa de misiones, ganar puntos y desbloquear insignias.
 *
 * Arquitectura:
 *   - Estado centralizado (GameState)
 *   - Los elementos HTML ya existen en index.html (no se generan desde JS)
 *   - Las animaciones se controlan mediante clases CSS
 *   - Datos de preguntas cargados desde data/questions.json
 *
 * Para agregar más preguntas: edita data/questions.json
 * ============================================================================
 */

// =============================================================================
// ESTADO GLOBAL DEL JUEGO Y DEL CURSO (AULA)
// =============================================================================

/**
 * Estado centralizado del juego.
 * Todas las funciones leen y escriben desde este objeto.
 */
const GameState = {
  currentScreen: 'studentSelect', // 'studentSelect' | 'start' | 'game' | 'victory' | 'gameover'
  completedMissions: [],      // IDs de misiones completadas [1, 2, ...]
  score: 0,                  // Puntaje acumulado
  lives: 3,                  // Vidas restantes
  maxLives: 3,               // Máximo de vidas
  badges: [],                // IDs de insignias desbloqueadas
  questionsData: null,        // Datos cargados de questions.json
  missionAttempts: {},        // Intentos fallidos por misión { missionId: count }
  isModalOpen: false,         // Controla si el modal está abierto
  isProcessing: false,        // Evita clics múltiples durante animaciones
  activeMissionId: null,      // Misión activa actual
  currentQuestionIndex: 0,    // Índice de pregunta interna de la misión
  unlockedRewards: []         // Premios desbloqueados [1, 2, 3]
};

// Claves para guardar progreso en localStorage
const STORAGE_KEY = 'la-porota-game-progress';
const CLASSROOM_KEY = 'la-porota-classroom-data';

// Instancia de base de datos Firebase Firestore
let firebaseDb = null;

// Estado de Control de Curso
const ClassroomState = {
  students: [],
  activeStudentId: null
};

// Alumnos precargados por defecto (Semillas)
const DEFAULT_STUDENTS = [
  { id: 'alonso', name: 'Alonso Torres', avatar: '🕵️', score: 0, completedMissions: [], lives: 3, badges: [], unlockedRewards: [], attempts: {} },
  { id: 'belen', name: 'Belén Gómez', avatar: '👧', score: 0, completedMissions: [], lives: 3, badges: [], unlockedRewards: [], attempts: {} },
  { id: 'catalina', name: 'Catalina Ruiz', avatar: '🧸', score: 0, completedMissions: [], lives: 3, badges: [], unlockedRewards: [], attempts: {} },
  { id: 'dante', name: 'Dante Silva', avatar: '🚀', score: 0, completedMissions: [], lives: 3, badges: [], unlockedRewards: [], attempts: {} },
  { id: 'elena', name: 'Elena Pastén', avatar: '🐱', score: 0, completedMissions: [], lives: 3, badges: [], unlockedRewards: [], attempts: {} },
  { id: 'facundo', name: 'Facundo Soto', avatar: '🕵️', score: 0, completedMissions: [], lives: 3, badges: [], unlockedRewards: [], attempts: {} }
];

// =============================================================================
// INICIALIZACIÓN
// =============================================================================

/**
 * init() — Punto de entrada de la aplicación.
 * Carga classroom, questions.json, configura eventos e inicializa.
 */
async function init() {
  try {
    // Cargar base de datos del curso desde Firebase o localStorage (asíncrono)
    await loadClassroom();

    // Cargar datos de preguntas
    const response = await fetch('./data/questions.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    GameState.questionsData = await response.json();

    // Aplicar configuración del JSON
    GameState.maxLives = GameState.questionsData.settings.maxLives;
    GameState.lives = GameState.maxLives;

    // Configurar event listeners
    setupEventListeners();

    // Generar estrellas decorativas
    generateStars('stars-container');
    generateStars('stars-container-select');

    // Renderizar grilla de selección de estudiantes
    renderStudentsGrid();

    // Mostrar pantalla de selección de alumno inicialmente
    showScreen('studentSelect');

    console.log('🎮 La Porota: Aula virtual y juego inicializados correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar:', error);
    // Mostrar mensaje de error amigable
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
      startScreen.innerHTML = `
        <div style="text-align:center; padding:2rem; color:#FFD700; font-family:'Nunito',sans-serif;">
          <h2>😢 ¡Ups! Algo salió mal</h2>
          <p style="color:#fff; margin:1rem 0;">No pudimos cargar las preguntas del juego.</p>
          <p style="color:#aaa;">Asegúrate de abrir este archivo desde un servidor local.</p>
          <button onclick="location.reload()" style="margin-top:1rem; padding:0.8rem 2rem; border-radius:50px; border:none; background:#FF6B9D; color:#fff; font-size:1.1rem; cursor:pointer; font-family:'Fredoka One',cursive;">
            🔄 Reintentar
          </button>
        </div>
      `;
    }
  }
}

// =============================================================================
// GENERADOR DE ESTRELLAS
// =============================================================================

/**
 * generateStars() — Crea partículas de estrellas flotantes en el contenedor indicado.
 */
function generateStars(containerId = 'stars-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Limpiar estrellas previas
  container.innerHTML = '';

  // Crear 40 estrellas con posiciones y tiempos aleatorios
  for (let i = 0; i < 40; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.animationDelay = `${Math.random() * 5}s`;
    star.style.animationDuration = `${2 + Math.random() * 4}s`;

    // Tamaño variado
    const size = 2 + Math.random() * 4;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;

    container.appendChild(star);
  }
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

/**
 * setupEventListeners() — Registra todos los manejadores de eventos.
 */
function setupEventListeners() {
  // Botón "Comenzar Aventura"
  const startBtn = document.getElementById('btn-start');
  if (startBtn) {
    startBtn.addEventListener('click', startGame);
  }

  // Botón "Volver a Selección de Alumno" (Inicio)
  const backToStartBtn = document.getElementById('btn-back-to-start');
  if (backToStartBtn) {
    backToStartBtn.addEventListener('click', () => {
      saveProgress();
      // Detener música si sale de la aventura para un comportamiento más limpio
      RetroSynth.stop();
      const soundIcon = document.getElementById('sound-icon');
      if (soundIcon) soundIcon.textContent = '🔇';
      showScreen('studentSelect');
    });
  }

  // Clic en carta de alumno en la grilla de selección
  const studentsGrid = document.getElementById('students-grid');
  if (studentsGrid) {
    studentsGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.student-card');
      if (card) {
        const studentId = card.dataset.id;
        selectStudent(studentId);
      }
    });
  }

  // Filtrado de alumnos en tiempo real (Buscador)
  const searchInput = document.getElementById('search-student-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const cards = document.querySelectorAll('.student-card');
      cards.forEach(card => {
        const name = card.querySelector('.student-card-name').textContent.toLowerCase();
        if (name.includes(query)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }

  // Abrir y cerrar Dashboard Docente
  const openDashboardBtn = document.getElementById('btn-open-dashboard');
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener('click', openDashboard);
  }

  const closeDashboardBtn = document.getElementById('btn-close-dashboard');
  if (closeDashboardBtn) {
    closeDashboardBtn.addEventListener('click', closeDashboard);
  }

  const closeDashboardBtnBottom = document.getElementById('btn-close-dashboard-bottom');
  if (closeDashboardBtnBottom) {
    closeDashboardBtnBottom.addEventListener('click', closeDashboard);
  }

  const dashboardOverlay = document.getElementById('dashboard-modal');
  if (dashboardOverlay) {
    dashboardOverlay.addEventListener('click', (e) => {
      if (e.target === dashboardOverlay) closeDashboard();
    });
  }

  // Abrir y cerrar Modal de Agregar Alumno
  const addStudentSelectBtn = document.getElementById('btn-add-student-select');
  if (addStudentSelectBtn) {
    addStudentSelectBtn.addEventListener('click', openAddStudentModal);
  }

  const addStudentDashboardBtn = document.getElementById('btn-add-student-dashboard');
  if (addStudentDashboardBtn) {
    addStudentDashboardBtn.addEventListener('click', openAddStudentModal);
  }

  const closeAddStudentBtn = document.getElementById('btn-close-add-student');
  if (closeAddStudentBtn) {
    closeAddStudentBtn.addEventListener('click', closeAddStudentModal);
  }

  const addStudentOverlay = document.getElementById('add-student-modal');
  if (addStudentOverlay) {
    addStudentOverlay.addEventListener('click', (e) => {
      if (e.target === addStudentOverlay) closeAddStudentModal();
    });
  }

  // Selección de avatar en el formulario de creación
  const avatarOptions = document.querySelectorAll('.avatar-option');
  avatarOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      avatarOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });

  // Envío del formulario de agregar alumno
  const addStudentForm = document.getElementById('add-student-form');
  if (addStudentForm) {
    addStudentForm.addEventListener('submit', handleAddStudentSubmit);
  }

  // Reiniciar todo el curso (Control de clase)
  const resetClassroomBtn = document.getElementById('btn-reset-classroom');
  if (resetClassroomBtn) {
    resetClassroomBtn.addEventListener('click', resetClassroom);
  }

  // Botón cerrar modal
  const closeBtn = document.getElementById('btn-close-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  // Clic en el fondo oscuro del modal (cerrar)
  const modalOverlay = document.getElementById('mission-modal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });
  }

  // Nodos de misión en el mapa
  for (let i = 1; i <= 5; i++) {
    const node = document.getElementById(`node-${i}`);
    if (node) {
      node.addEventListener('click', () => openMission(i));
    }
  }

  // Delegación de eventos para opciones de respuesta (se generan dinámicamente)
  const answersGrid = document.getElementById('answers-grid');
  if (answersGrid) {
    answersGrid.addEventListener('click', (e) => {
      const option = e.target.closest('.answer-option');
      if (option && !option.classList.contains('disabled') && !option.classList.contains('correct') && !option.classList.contains('wrong')) {
        const missionId = parseInt(option.dataset.mission, 10);
        const answerIndex = parseInt(option.dataset.index, 10);
        selectAnswer(missionId, answerIndex);
      }
    });
  }

  // Botones de reinicio (victoria y game over)
  const playAgainBtn = document.getElementById('btn-play-again');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', resetGame);
  }

  const retryBtn = document.getElementById('btn-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', resetGame);
  }

  // Tecla Escape para cerrar modales
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (GameState.isModalOpen) closeModal();
      closeRewardsModal();
      closeVisor();
      closeInfographic();
      closeCharacterGuideViewer();
      closeDashboard();
      closeAddStudentModal();
    }
  });

  // Botón del Baúl de Recompensas flotante
  const chestBtn = document.getElementById('rewards-chest-btn');
  if (chestBtn) {
    chestBtn.addEventListener('click', openRewardsModal);
  }

  // Botón para silenciar/activar la música retro
  const toggleSoundBtn = document.getElementById('btn-toggle-sound');
  if (toggleSoundBtn) {
    toggleSoundBtn.addEventListener('click', () => {
      RetroSynth.toggle();
    });
  }

  // Cerrar modal de recompensas
  const closeRewardsBtn = document.getElementById('btn-close-rewards');
  if (closeRewardsBtn) {
    closeRewardsBtn.addEventListener('click', closeRewardsModal);
  }

  // Fondo del modal de recompensas
  const rewardsModal = document.getElementById('rewards-modal');
  if (rewardsModal) {
    rewardsModal.addEventListener('click', (e) => {
      if (e.target === rewardsModal) closeRewardsModal();
    });
  }

  // Botones de acción dentro del Baúl
  const viewReward1 = document.getElementById('btn-view-reward-1');
  if (viewReward1) {
    viewReward1.addEventListener('click', () => openVisor(1));
  }

  const viewReward2 = document.getElementById('btn-view-reward-2');
  if (viewReward2) {
    viewReward2.addEventListener('click', openInfographic);
  }

  const viewReward3 = document.getElementById('btn-view-reward-3');
  if (viewReward3) {
    viewReward3.addEventListener('click', () => openVisor(3));
  }

  // Cerrar visor de fichas
  const closeVisorBtn = document.getElementById('btn-close-visor');
  if (closeVisorBtn) {
    closeVisorBtn.addEventListener('click', closeVisor);
  }

  const visorModal = document.getElementById('visor-modal');
  if (visorModal) {
    visorModal.addEventListener('click', (e) => {
      if (e.target === visorModal) closeVisor();
    });
  }

  // Imprimir ficha
  const printVisorBtn = document.getElementById('btn-print-visor');
  if (printVisorBtn) {
    printVisorBtn.addEventListener('click', () => window.print());
  }

  // Descargar ficha SVG
  const downloadVisorBtn = document.getElementById('btn-download-visor');
  if (downloadVisorBtn) {
    downloadVisorBtn.addEventListener('click', downloadSVG);
  }

  // Cerrar infografía
  const closeInfoBtn = document.getElementById('btn-close-info');
  if (closeInfoBtn) {
    closeInfoBtn.addEventListener('click', closeInfographic);
  }

  const infoModal = document.getElementById('infographic-modal');
  if (infoModal) {
    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) closeInfographic();
    });
  }

  // Navegación de pestañas de infografía (delegación)
  const tabContainer = document.querySelector('.info-tabs');
  if (tabContainer) {
    tabContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.info-tab-btn');
      if (btn) {
        // Remover active de todos los botones y contenidos
        document.querySelectorAll('.info-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.info-tab-content').forEach(c => c.classList.remove('active'));

        // Agregar active al actual
        btn.classList.add('active');
        const tabId = btn.dataset.tab;
        const content = document.getElementById(tabId);
        if (content) content.classList.add('active');
      }
    });
  }

  // Visualizador de Guía de Personajes
  const charGuideBanner = document.getElementById('char-guide-banner');
  if (charGuideBanner) {
    charGuideBanner.addEventListener('click', openCharacterGuideViewer);
  }

  const closeImageViewerBtn = document.getElementById('btn-close-image-viewer');
  if (closeImageViewerBtn) {
    closeImageViewerBtn.addEventListener('click', closeCharacterGuideViewer);
  }

  const imageViewerModal = document.getElementById('image-viewer-modal');
  if (imageViewerModal) {
    imageViewerModal.addEventListener('click', (e) => {
      if (e.target === imageViewerModal) {
        closeCharacterGuideViewer();
      }
    });
  }
}

// =============================================================================
// CONTROL DE PANTALLAS
// =============================================================================

/**
 * showScreen(screenName) — Muestra una pantalla y oculta las demás.
 * @param {string} screenName — 'start' | 'game' | 'victory' | 'gameover'
 */
function showScreen(screenName) {
  const screens = {
    studentSelect: document.getElementById('student-select-screen'),
    start: document.getElementById('start-screen'),
    game: document.getElementById('game-screen'),
    victory: document.getElementById('victory-screen'),
    gameover: document.getElementById('gameover-screen')
  };

  // Ocultar todas las pantallas
  Object.values(screens).forEach(screen => {
    if (screen) screen.classList.remove('active');
  });

  // Mostrar la pantalla indicada
  const target = screens[screenName];
  if (target) {
    target.classList.add('active');
  }

  GameState.currentScreen = screenName;
}

// =============================================================================
// INICIO DEL JUEGO
// =============================================================================

/**
 * startGame() — Transiciona de la pantalla de inicio al juego.
 */
function startGame() {
  showScreen('game');
  updateMap();
  updateUI();
  saveProgress();
  
  // Iniciar la música retro de fondo
  try {
    RetroSynth.start();
    const soundIcon = document.getElementById('sound-icon');
    if (soundIcon) soundIcon.textContent = '🔊';
  } catch (e) {
    console.warn("Audio Context blocked:", e);
  }
  
  console.log('🚀 ¡La aventura ha comenzado!');
}

// =============================================================================
// MAPA DE MISIONES
// =============================================================================

/**
 * updateMap() — Actualiza el estado visual de cada nodo del mapa.
 * Los nodos pueden estar: bloqueados, activos (siguiente por jugar) o completados.
 */
function updateMap() {
  if (!GameState.questionsData) return;

  const missions = GameState.questionsData.missions;

  missions.forEach((mission, index) => {
    const node = document.getElementById(`node-${mission.id}`);
    const pathSeg = document.getElementById(`path-${mission.id - 1}-${mission.id}`);
    if (!node) return;

    const isCompleted = GameState.completedMissions.includes(mission.id);
    const isAvailable = isMissionAvailable(mission.id);
    const isNext = isAvailable && !isCompleted;

    // Limpiar clases de estado previas
    node.classList.remove('locked', 'active', 'completed');

    if (isCompleted) {
      // Misión completada
      node.classList.add('completed');
      node.disabled = true;

      // Actualizar icono a checkmark
      const iconSpan = node.querySelector('.node-icon');
      if (iconSpan) iconSpan.textContent = '✅';

      // Marcar segmento del camino como completado
      if (pathSeg) pathSeg.classList.add('completed');

    } else if (isNext) {
      // Próxima misión disponible
      node.classList.add('active');
      node.disabled = false;

    } else {
      // Misión bloqueada
      node.classList.add('locked');
      node.disabled = true;
    }
  });

  // Actualizar la ambientación (fondo) del mapa en función de la misión activa actual
  const gameScreen = document.getElementById('game-screen');
  if (gameScreen) {
    const activeMission = GameState.completedMissions.length + 1;
    // Limpiar clases de misión previas
    gameScreen.classList.remove('mission-1', 'mission-2', 'mission-3', 'mission-4', 'mission-5');
    // Asignar clase de fondo para la misión activa
    gameScreen.classList.add(`mission-${Math.min(5, activeMission)}`);
  }
}

/**
 * isMissionAvailable(missionId) — Verifica si una misión está desbloqueada.
 * La misión 1 siempre está disponible. Las demás requieren la anterior completada.
 */
function isMissionAvailable(missionId) {
  if (missionId === 1) return true;
  return GameState.completedMissions.includes(missionId - 1);
}

// =============================================================================
// MODAL DE MISIÓN (QUIZ)
// =============================================================================

/**
 * openMission(missionId) — Abre el modal con la pregunta de la misión.
 */
function openMission(missionId) {
  if (GameState.isProcessing) return;

  // Verificar disponibilidad
  if (!isMissionAvailable(missionId)) return;

  // Verificar que no esté completada
  if (GameState.completedMissions.includes(missionId)) return;

  // Buscar datos de la misión
  const mission = GameState.questionsData.missions.find(m => m.id === missionId);
  if (!mission) return;

  // Si abrimos una nueva misión, inicializar el índice de pregunta activa
  if (GameState.activeMissionId !== missionId) {
    GameState.activeMissionId = missionId;
    GameState.currentQuestionIndex = 0;
  }

  // Inicializar intentos si es la primera vez
  if (!GameState.missionAttempts[missionId]) {
    GameState.missionAttempts[missionId] = 0;
  }

  // Obtener datos de la pregunta actual dentro del arreglo
  const questions = mission.questions;
  const currentQuestion = questions[GameState.currentQuestionIndex];
  if (!currentQuestion) return;

  // Llenar el contenido del modal
  const modalNumber = document.getElementById('modal-mission-number');
  const modalTitle = document.getElementById('modal-title');
  const modalLocation = document.getElementById('modal-location');
  const modalDescription = document.getElementById('modal-description');
  const questionIcon = document.getElementById('question-icon');
  const questionText = document.getElementById('question-text');
  const answersGrid = document.getElementById('answers-grid');
  const hintArea = document.getElementById('hint-area');
  const hintText = document.getElementById('hint-text');
  const attemptsCount = document.getElementById('attempts-count');

  if (modalNumber) {
    modalNumber.textContent = `Misión ${mission.id} - Pregunta ${GameState.currentQuestionIndex + 1} de ${questions.length}`;
  }
  if (modalTitle) modalTitle.textContent = mission.title;
  if (modalLocation) modalLocation.textContent = `📍 ${mission.location}`;
  if (modalDescription) modalDescription.textContent = mission.description;
  if (questionIcon) questionIcon.textContent = mission.icon;
  if (questionText) questionText.textContent = currentQuestion.question;
  if (attemptsCount) attemptsCount.textContent = GameState.missionAttempts[missionId];

  // Generar las opciones de respuesta
  if (answersGrid) {
    const letters = ['A', 'B', 'C', 'D'];
    answersGrid.innerHTML = currentQuestion.options.map((option, index) => `
      <button class="answer-option" data-mission="${mission.id}" data-index="${index}" 
              aria-label="Opción ${letters[index]}: ${option}">
        <span class="answer-letter">${letters[index]}</span>
        <span class="answer-text">${option}</span>
      </button>
    `).join('');
  }

  // Mostrar pista si ya tiene 2+ intentos fallidos
  if (hintArea && hintText) {
    if (GameState.missionAttempts[missionId] >= 2) {
      hintText.textContent = currentQuestion.hint;
      hintArea.style.display = 'flex';
    } else {
      hintArea.style.display = 'none';
    }
  }

  // Mostrar el modal
  const modal = document.getElementById('mission-modal');
  if (modal) {
    modal.classList.add('active');
    // Reset animation on modal card
    const card = document.getElementById('modal-card');
    if (card) {
      card.style.animation = 'none';
      void card.offsetWidth; // Trigger reflow
      card.style.animation = '';
    }
  }

  GameState.isModalOpen = true;
}

/**
 * closeModal() — Cierra el modal de misión.
 */
function closeModal() {
  const modal = document.getElementById('mission-modal');
  if (modal) {
    modal.classList.remove('active');
  }
  GameState.isModalOpen = false;
}

// =============================================================================
// LÓGICA DE RESPUESTAS
// =============================================================================

/**
 * selectAnswer(missionId, answerIndex) — Procesa la selección de una respuesta.
 */
function selectAnswer(missionId, answerIndex) {
  if (GameState.isProcessing) return;
  GameState.isProcessing = true;

  const mission = GameState.questionsData.missions.find(m => m.id === missionId);
  if (!mission) {
    GameState.isProcessing = false;
    return;
  }

  const currentQuestion = mission.questions[GameState.currentQuestionIndex];
  const isCorrect = answerIndex === currentQuestion.correctAnswer;
  const answersGrid = document.getElementById('answers-grid');

  if (answersGrid) {
    const options = answersGrid.querySelectorAll('.answer-option');

    // Deshabilitar todas las opciones
    options.forEach(opt => opt.classList.add('disabled'));

    // Marcar la opción seleccionada
    const selectedOption = options[answerIndex];
    if (selectedOption) {
      selectedOption.classList.add(isCorrect ? 'correct' : 'wrong');
    }

    // Si es incorrecta, revelar la correcta tras un momento
    if (!isCorrect) {
      setTimeout(() => {
        options[currentQuestion.correctAnswer].classList.add('correct');
      }, 800);
    }
  }

  // Procesar resultado con retraso para ver la animación
  setTimeout(() => {
    if (isCorrect) {
      handleCorrectAnswer(mission, currentQuestion);
    } else {
      handleWrongAnswer(mission, currentQuestion);
    }
  }, isCorrect ? 800 : 1600);
}

/**
 * handleCorrectAnswer(mission, currentQuestion) — Procesa una respuesta correcta.
 */
function handleCorrectAnswer(mission, currentQuestion) {
  // Sumar puntos de esta pregunta
  GameState.score += currentQuestion.points;

  // Actualizar interfaz inmediatamente para reflejar el nuevo puntaje
  updateUI();

  // Lanzar confeti y animar puntos
  createConfetti();
  animatePoints(currentQuestion.points);

  const hasNextQuestion = GameState.currentQuestionIndex + 1 < mission.questions.length;

  if (hasNextQuestion) {
    // Aún quedan preguntas en esta misión
    closeModal();
    showSuccessFeedback(currentQuestion.successMessage, currentQuestion.points);

    setTimeout(() => {
      GameState.currentQuestionIndex++;
      openMission(mission.id);
      updateUI();
      saveProgress();
      GameState.isProcessing = false;
    }, 2500);

  } else {
    // Era la última pregunta de la misión. ¡Misión completada!
    if (!GameState.completedMissions.includes(mission.id)) {
      GameState.completedMissions.push(mission.id);
    }

    closeModal();
    showSuccessFeedback(currentQuestion.successMessage, currentQuestion.points);

    // Actualizar interfaz y verificar logros tras un breve momento
    setTimeout(() => {
      updateMap();
      checkRewards(); // Desbloquear recompensas didácticas
      checkBadges(); // Desbloquear insignias
      updateUI();
      saveProgress();

      // Verificar victoria total
      const totalMissions = GameState.questionsData.missions.length;
      if (GameState.completedMissions.length >= totalMissions) {
        setTimeout(() => {
          showVictoryScreen();
        }, 1500);
      }

      GameState.isProcessing = false;
    }, 2500);
  }
}

/**
 * handleWrongAnswer(mission, currentQuestion) — Procesa una respuesta incorrecta.
 */
function handleWrongAnswer(mission, currentQuestion) {
  // Incrementar intentos de la misión
  GameState.missionAttempts[mission.id] = (GameState.missionAttempts[mission.id] || 0) + 1;

  // Restar una vida
  GameState.lives = Math.max(0, GameState.lives - 1);

  // Sacudir el display de vidas
  const heartsContainer = document.getElementById('hearts-container');
  if (heartsContainer) {
    shakeElement(heartsContainer);
  }

  // Actualizar UI de vidas
  updateLivesDisplay();

  // Mostrar feedback de error de la pregunta actual
  showErrorFeedback(currentQuestion.failMessage);

  // Guardar progreso
  saveProgress();

  // Verificar game over
  if (GameState.lives <= 0) {
    closeModal();
    setTimeout(() => {
      showGameOverScreen();
      GameState.isProcessing = false;
    }, 1500);
    return;
  }

  // Si aún tiene vidas, cerrar y reabrir para reintentar la misma pregunta
  closeModal();
  setTimeout(() => {
    openMission(mission.id);
    GameState.isProcessing = false;
  }, 1200);
}

// =============================================================================
// SISTEMA DE INSIGNIAS
// =============================================================================

/**
 * checkBadges() — Verifica si se deben desbloquear nuevas insignias.
 */
function checkBadges() {
  if (!GameState.questionsData || !GameState.questionsData.badges) return;

  GameState.questionsData.badges.forEach(badge => {
    // Saltar si ya está desbloqueada
    if (GameState.badges.includes(badge.id)) return;

    // Verificar si todas las misiones requeridas están completadas
    const allRequired = badge.requiredMissions.every(missionId =>
      GameState.completedMissions.includes(missionId)
    );

    if (allRequired) {
      unlockBadge(badge);
    }
  });
}

/**
 * unlockBadge(badge) — Desbloquea una insignia y muestra notificación.
 */
function unlockBadge(badge) {
  if (GameState.badges.includes(badge.id)) return;

  // Agregar al estado
  GameState.badges.push(badge.id);

  // Actualizar el badge visual en la barra superior
  const badgeEl = document.getElementById(`badge-${badge.id}`);
  if (badgeEl) {
    badgeEl.classList.remove('locked');
    badgeEl.classList.add('unlocked');
    const iconEl = badgeEl.querySelector('.badge-icon');
    if (iconEl) iconEl.textContent = badge.icon;
    badgeEl.title = `${badge.name} - ${badge.description}`;
  }

  // Mostrar notificación tipo toast
  showBadgeNotification(badge);

  // Guardar progreso
  saveProgress();

  console.log(`🏅 Insignia desbloqueada: ${badge.name}`);
}

/**
 * showBadgeNotification(badge) — Muestra toast de insignia desbloqueada.
 */
function showBadgeNotification(badge) {
  const notif = document.getElementById('badge-notification');
  const notifIcon = document.getElementById('badge-notif-icon');
  const notifTitle = document.getElementById('badge-notif-title');
  const notifDesc = document.getElementById('badge-notif-desc');

  if (notifIcon) notifIcon.textContent = badge.icon;
  if (notifTitle) notifTitle.textContent = `¡${badge.name}!`;
  if (notifDesc) notifDesc.textContent = badge.description;

  if (notif) {
    notif.classList.add('active');
    // Ocultar después de 4 segundos
    setTimeout(() => {
      notif.classList.remove('active');
    }, 4000);
  }
}

// =============================================================================
// SISTEMA DE RECOMPENSAS (BAÚL DE RECOMPENSAS)
// =============================================================================

/**
 * checkRewards() — Verifica y desbloquea premios didácticos (fichas y la infografía)
 */
function checkRewards() {
  if (!GameState.unlockedRewards) GameState.unlockedRewards = [];

  const milestones = [
    { id: 1, mission: 1, name: "Ficha para Colorear 1", desc: "¡Porota y Mimí desbloqueadas en tu Baúl!" },
    { id: 2, mission: 3, name: "Infografía del Libro", desc: "¡Guía de secretos desbloqueada en tu Baúl!" },
    { id: 3, mission: 5, name: "Ficha para Colorear 2", desc: "¡Celebración final desbloqueada en tu Baúl!" }
  ];

  milestones.forEach(m => {
    if (GameState.completedMissions.includes(m.mission) && !GameState.unlockedRewards.includes(m.id)) {
      GameState.unlockedRewards.push(m.id);
      
      // Mostrar una notificación de premio similar a la de insignias
      showBadgeNotification({
        icon: m.id === 2 ? "📊" : "🎨",
        name: m.name,
        description: m.desc
      });
      
      console.log(`🎁 Recompensa desbloqueada: ${m.name}`);
    }
  });
}

/**
 * openRewardsModal() — Abre la interfaz del Baúl
 */
function openRewardsModal() {
  const modal = document.getElementById('rewards-modal');
  if (!modal) return;

  // Actualizar las tarjetas visualmente antes de mostrar
  const ids = [1, 2, 3];
  ids.forEach(id => {
    const cardEl = document.getElementById(`reward-card-${id}`);
    const btnEl = document.getElementById(`btn-view-reward-${id}`);
    
    if (cardEl && btnEl) {
      const isUnlocked = GameState.unlockedRewards.includes(id);
      if (isUnlocked) {
        cardEl.classList.remove('locked');
        cardEl.classList.add('unlocked');
        btnEl.disabled = false;
        
        const badgeStatus = cardEl.querySelector('.reward-badge-status');
        if (badgeStatus) badgeStatus.textContent = "✨ ¡Desbloqueado!";
      } else {
        cardEl.classList.remove('unlocked');
        cardEl.classList.add('locked');
        btnEl.disabled = true;
        
        const badgeStatus = cardEl.querySelector('.reward-badge-status');
        if (badgeStatus) badgeStatus.textContent = "🔒 Bloqueado";
      }
    }
  });

  modal.classList.add('active');
}

/**
 * closeRewardsModal() — Cierra la interfaz del Baúl
 */
function closeRewardsModal() {
  const modal = document.getElementById('rewards-modal');
  if (modal) modal.classList.remove('active');
}

let activeVisorRewardId = null;

/**
 * openVisor(rewardId) — Abre el visor de fichas de colorear cargando el SVG
 */
async function openVisor(rewardId) {
  activeVisorRewardId = rewardId;
  const visorContent = document.getElementById('visor-content-frame');
  const visorTitle = document.getElementById('visor-title');
  const modal = document.getElementById('visor-modal');

  if (visorTitle) {
    visorTitle.textContent = rewardId === 1 ? "Ficha: Porota y su Muñeca Mimí" : "Ficha: La Victoria en la Ciudad";
  }

  if (visorContent) {
    visorContent.innerHTML = `<div style="color: var(--color-primary); font-family: var(--font-heading); font-size: var(--fs-md); padding: 2rem; text-align: center;">🎨 Abriendo cuaderno de dibujo...</div>`;
  }

  if (modal) modal.classList.add('active');

  try {
    const fileNum = rewardId === 1 ? 1 : 2;
    const response = await fetch(`./img/coloring-${fileNum}.svg`);
    if (!response.ok) throw new Error("No se pudo cargar el dibujo.");
    const svgText = await response.text();
    if (visorContent) visorContent.innerHTML = svgText;
  } catch (error) {
    if (visorContent) {
      visorContent.innerHTML = `<div style="color: var(--color-coral); text-align: center; padding: 2rem;">😢 No pudimos cargar el dibujo: ${error.message}</div>`;
    }
  }
}

/**
 * closeVisor() — Cierra el visor de fichas
 */
function closeVisor() {
  const modal = document.getElementById('visor-modal');
  if (modal) modal.classList.remove('active');
  activeVisorRewardId = null;
}

/**
 * downloadSVG() — Descarga el dibujo activo en formato SVG
 */
function downloadSVG() {
  if (!activeVisorRewardId) return;
  const fileNum = activeVisorRewardId === 1 ? 1 : 2;
  const fileName = activeVisorRewardId === 1 ? 'colorea_porota_y_mimi.svg' : 'colorea_victoria_en_la_ciudad.svg';
  
  const link = document.createElement('a');
  link.href = `./img/coloring-${fileNum}.svg`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * openInfographic() — Abre el modal interactivo de la infografía
 */
function openInfographic() {
  const modal = document.getElementById('infographic-modal');
  if (!modal) return;

  // Resetear a la primera pestaña de forma limpia
  document.querySelectorAll('.info-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.info-tab-content').forEach(content => content.classList.remove('active'));

  const firstBtn = document.querySelector('.info-tab-btn[data-tab="tab-autor"]');
  const firstContent = document.getElementById('tab-autor');
  
  if (firstBtn) firstBtn.classList.add('active');
  if (firstContent) firstContent.classList.add('active');

  modal.classList.add('active');
}

/**
 * closeInfographic() — Cierra la infografía
 */
function closeInfographic() {
  const modal = document.getElementById('infographic-modal');
  if (modal) modal.classList.remove('active');
}

/**
 * openCharacterGuideViewer() — Abre el visor de imagen completa para la Guía de Personajes
 */
function openCharacterGuideViewer() {
  const modal = document.getElementById('image-viewer-modal');
  if (modal) modal.classList.add('active');
}

/**
 * closeCharacterGuideViewer() — Cierra el visor de imagen completa
 */
function closeCharacterGuideViewer() {
  const modal = document.getElementById('image-viewer-modal');
  if (modal) modal.classList.remove('active');
}

// =============================================================================
// ACTUALIZACIÓN DE INTERFAZ
// =============================================================================

/**
 * updateUI() — Actualiza puntaje, vidas e insignias.
 */
function updateUI() {
  // Puntaje
  const scoreValue = document.getElementById('score-value');
  if (scoreValue) scoreValue.textContent = GameState.score;

  // Vidas
  updateLivesDisplay();

  // Insignias (restaurar las desbloqueadas)
  if (GameState.questionsData) {
    GameState.questionsData.badges.forEach(badge => {
      if (GameState.badges.includes(badge.id)) {
        const badgeEl = document.getElementById(`badge-${badge.id}`);
        if (badgeEl) {
          badgeEl.classList.remove('locked');
          badgeEl.classList.add('unlocked');
          const iconEl = badgeEl.querySelector('.badge-icon');
          if (iconEl) iconEl.textContent = badge.icon;
          badgeEl.title = `${badge.name} - ${badge.description}`;
        }
      }
    });
  }

  // Actualizar Baúl de Recompensas flotante
  const chestBtn = document.getElementById('rewards-chest-btn');
  const chestBadge = document.getElementById('chest-badge-count');
  
  if (chestBtn && chestBadge) {
    const unlockedCount = GameState.unlockedRewards ? GameState.unlockedRewards.length : 0;
    chestBadge.textContent = unlockedCount;
    
    if (unlockedCount > 0) {
      chestBtn.classList.remove('locked');
      chestBtn.classList.add('unlocked');
    } else {
      chestBtn.classList.remove('unlocked');
      chestBtn.classList.add('locked');
    }
  }
}

/**
 * updateLivesDisplay() — Actualiza los corazones de vidas.
 */
function updateLivesDisplay() {
  const heartsContainer = document.getElementById('hearts-container');
  if (!heartsContainer) return;

  let heartsHTML = '';
  for (let i = 0; i < GameState.maxLives; i++) {
    if (i < GameState.lives) {
      heartsHTML += '<span class="heart active" aria-label="Vida activa">❤️</span>';
    } else {
      heartsHTML += '<span class="heart lost" aria-label="Vida perdida">🖤</span>';
    }
  }
  heartsContainer.innerHTML = heartsHTML;
}

// =============================================================================
// FEEDBACK VISUAL
// =============================================================================

/**
 * showSuccessFeedback(message, points) — Muestra overlay de éxito.
 */
function showSuccessFeedback(message, points) {
  const overlay = document.getElementById('feedback-overlay');
  const icon = document.getElementById('feedback-icon');
  const msg = document.getElementById('feedback-message');
  const pts = document.getElementById('feedback-points');

  if (icon) icon.textContent = '🌟';
  if (msg) msg.textContent = message;
  if (pts) {
    pts.textContent = `+${points}`;
    pts.style.display = 'block';
  }

  if (overlay) {
    overlay.className = 'feedback-overlay active success';

    // Resetear animación
    const content = document.getElementById('feedback-content');
    if (content) {
      content.style.animation = 'none';
      void content.offsetWidth;
      content.style.animation = '';
    }

    setTimeout(() => {
      overlay.className = 'feedback-overlay';
    }, 2500);
  }
}

/**
 * showErrorFeedback(message) — Muestra overlay de error.
 */
function showErrorFeedback(message) {
  const overlay = document.getElementById('feedback-overlay');
  const icon = document.getElementById('feedback-icon');
  const msg = document.getElementById('feedback-message');
  const pts = document.getElementById('feedback-points');

  if (icon) icon.textContent = '💪';
  if (msg) msg.textContent = message;
  if (pts) pts.style.display = 'none';

  if (overlay) {
    overlay.className = 'feedback-overlay active error';

    const content = document.getElementById('feedback-content');
    if (content) {
      content.style.animation = 'none';
      void content.offsetWidth;
      content.style.animation = '';
    }

    setTimeout(() => {
      overlay.className = 'feedback-overlay';
    }, 3000);
  }
}

// =============================================================================
// CONFETI
// =============================================================================

/**
 * createConfetti() — Genera 60 piezas de confeti con colores y tiempos aleatorios.
 */
function createConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;

  // Limpiar confeti anterior
  container.innerHTML = '';

  const colors = [
    '#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF',
    '#FF8B94', '#B5EAD7', '#C7CEEA', '#FFDAC1',
    '#FF6B9D', '#FFD700', '#4A90D9', '#2ECC71'
  ];

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

    const size = 6 + Math.random() * 10;
    piece.style.width = `${size}px`;
    piece.style.height = `${size}px`;

    const duration = 2 + Math.random() * 3;
    piece.style.animationDuration = `${duration}s`;
    piece.style.animationDelay = `${Math.random() * 2}s`;

    // Rotación aleatoria
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;

    container.appendChild(piece);

    // Auto-eliminar
    setTimeout(() => {
      if (piece.parentNode) piece.parentNode.removeChild(piece);
    }, (duration + 2) * 1000 + 500);
  }
}

// =============================================================================
// ANIMACIONES AUXILIARES
// =============================================================================

/**
 * shakeElement(element) — Efecto de sacudida (para errores).
 */
function shakeElement(element) {
  if (!element) return;
  element.style.animation = 'none';
  void element.offsetWidth;
  element.style.animation = 'shake 0.5s ease';
  setTimeout(() => {
    element.style.animation = '';
  }, 500);
}

/**
 * animatePoints(points) — Muestra "+100" flotante sobre el marcador de puntaje.
 */
function animatePoints(points) {
  const container = document.getElementById('floating-points');
  if (!container) return;

  const floater = document.createElement('div');
  floater.className = 'floating-point';
  floater.textContent = `+${points}`;

  // Posicionar cerca del marcador de puntaje
  const scoreEl = document.getElementById('score-display');
  if (scoreEl) {
    const rect = scoreEl.getBoundingClientRect();
    floater.style.left = `${rect.left + rect.width / 2}px`;
    floater.style.top = `${rect.bottom + 10}px`;
  } else {
    floater.style.left = '50%';
    floater.style.top = '80px';
  }

  container.appendChild(floater);

  // Auto-eliminar después de la animación
  setTimeout(() => {
    if (floater.parentNode) floater.parentNode.removeChild(floater);
  }, 1500);
}

// =============================================================================
// PANTALLA DE VICTORIA
// =============================================================================

/**
 * showVictoryScreen() — Muestra la pantalla de celebración final.
 */
function showVictoryScreen() {
  // Actualizar estadísticas
  const finalScore = document.getElementById('final-score');
  const finalLives = document.getElementById('final-lives');
  const finalBadges = document.getElementById('final-badges');

  if (finalScore) finalScore.textContent = GameState.score;
  if (finalLives) finalLives.textContent = GameState.lives;
  if (finalBadges) finalBadges.textContent = GameState.badges.length;

  // Renderizar insignias obtenidas
  const victoryBadges = document.getElementById('victory-badges');
  if (victoryBadges && GameState.questionsData) {
    victoryBadges.innerHTML = GameState.questionsData.badges
      .filter(b => GameState.badges.includes(b.id))
      .map(badge => `
        <div class="victory-badge-item">
          <div class="victory-badge-icon">${badge.icon}</div>
          <span class="victory-badge-name">${badge.name}</span>
        </div>
      `).join('');
  }

  // Mostrar pantalla
  showScreen('victory');

  // Lanzar confeti continuo
  createConfetti();
  setTimeout(() => createConfetti(), 2000);
  setTimeout(() => createConfetti(), 4000);

  // Limpiar progreso (juego terminado)
  clearSavedProgress();
}

// =============================================================================
// PANTALLA DE GAME OVER
// =============================================================================

/**
 * showGameOverScreen() — Muestra la pantalla de fin de juego (motivadora).
 */
function showGameOverScreen() {
  const gameoverMission = document.getElementById('gameover-mission');
  const gameoverScore = document.getElementById('gameover-score');

  // Mostrar en qué misión se quedó
  const nextMission = GameState.completedMissions.length + 1;
  if (gameoverMission) gameoverMission.textContent = nextMission;
  if (gameoverScore) gameoverScore.textContent = GameState.score;

  showScreen('gameover');
  clearSavedProgress();
}

// =============================================================================
// REINICIO DEL JUEGO
// =============================================================================

/**
 * resetGame() — Reinicia completamente el juego al estado inicial.
 */
function resetGame() {
  // Resetear estado
  GameState.completedMissions = [];
  GameState.score = 0;
  GameState.lives = GameState.maxLives;
  GameState.badges = [];
  GameState.missionAttempts = {};
  GameState.isModalOpen = false;
  GameState.isProcessing = false;
  GameState.activeMissionId = null;
  GameState.currentQuestionIndex = 0;
  GameState.unlockedRewards = [];

  // Resetear badges visuales en la barra
  if (GameState.questionsData) {
    GameState.questionsData.badges.forEach(badge => {
      const badgeEl = document.getElementById(`badge-${badge.id}`);
      if (badgeEl) {
        badgeEl.classList.remove('unlocked');
        badgeEl.classList.add('locked');
        const iconEl = badgeEl.querySelector('.badge-icon');
        if (iconEl) iconEl.textContent = '❓';
      }
    });
  }

  // Resetear nodos del mapa a su estado original
  for (let i = 1; i <= 5; i++) {
    const node = document.getElementById(`node-${i}`);
    if (node) {
      node.classList.remove('locked', 'active', 'completed');
      node.classList.add(i === 1 ? 'active' : 'locked');
      node.disabled = (i !== 1);

      // Restaurar iconos originales
      const icons = ['🔍', '🧟', '💕', '🔨', '⭐'];
      const iconSpan = node.querySelector('.node-icon');
      if (iconSpan) iconSpan.textContent = icons[i - 1];
    }

    // Resetear segmentos de camino
    const pathSeg = document.getElementById(`path-${i - 1}-${i}`);
    if (pathSeg) pathSeg.classList.remove('completed');
  }

  // Limpiar confeti
  const confettiContainer = document.getElementById('confetti-container');
  if (confettiContainer) confettiContainer.innerHTML = '';

  // Limpiar progreso guardado
  clearSavedProgress();

  // Volver a pantalla de inicio
  showScreen('start');

  // Regenerar estrellas
  generateStars();

  console.log('🔄 Juego reiniciado');
}

// =============================================================================
// PERSISTENCIA POR ALUMNO (LOCAL & BACKEND FIREBASE HÍBRIDO)
// =============================================================================

/**
 * loadClassroom() — Carga la base de datos del curso desde Firebase Firestore o localStorage.
 * Si no existe, la inicializa con los 6 alumnos por defecto.
 */
async function loadClassroom() {
  // Inicializar Firebase si la variable de configuración está en true y fue editada
  if (typeof firebase !== 'undefined' && typeof USE_FIREBASE !== 'undefined' && USE_FIREBASE && firebaseConfig.projectId !== "TU_PROJECT_ID") {
    if (!firebaseDb) {
      try {
        firebase.initializeApp(firebaseConfig);
        firebaseDb = firebase.firestore();
        console.log("🔥 Firebase Firestore inicializado y conectado correctamente!");
      } catch (e) {
        console.warn("⚠️ No se pudo inicializar Firebase:", e.message);
      }
    }
  }

  // Carga desde Firebase
  if (firebaseDb) {
    try {
      const doc = await firebaseDb.collection("classrooms").doc("la-porota-course").get();
      if (doc.exists) {
        const data = doc.data();
        if (data && Array.isArray(data.students)) {
          ClassroomState.students = data.students;
          ClassroomState.activeStudentId = data.activeStudentId || null;
          console.log("🔥 Datos del curso sincronizados exitosamente desde Firebase Firestore");
          return;
        }
      } else {
        // Guardar las semillas iniciales en Firebase
        ClassroomState.students = JSON.parse(JSON.stringify(DEFAULT_STUDENTS));
        ClassroomState.activeStudentId = null;
        await saveClassroom();
        console.log("🔥 Creada base del curso inicial (Semillas) en Firebase Firestore");
        return;
      }
    } catch (e) {
      console.warn("⚠️ Error al leer de Firestore, recurriendo a localStorage:", e.message);
    }
  }

  // Carga desde localStorage (Fallback de Respaldo)
  try {
    const saved = localStorage.getItem(CLASSROOM_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      if (data && Array.isArray(data.students)) {
        ClassroomState.students = data.students;
        ClassroomState.activeStudentId = data.activeStudentId || null;
        console.log('📂 Base de datos del curso cargada con éxito desde localStorage');
        return;
      }
    }
    // Inicializar por defecto si no hay datos válidos
    ClassroomState.students = JSON.parse(JSON.stringify(DEFAULT_STUDENTS));
    ClassroomState.activeStudentId = null;
    saveClassroom();
    console.log('🌱 Base de datos del curso inicializada localmente con semillas por defecto');
  } catch (e) {
    console.warn('⚠️ Error al cargar classroom localmente, usando valores de respaldo:', e);
    ClassroomState.students = JSON.parse(JSON.stringify(DEFAULT_STUDENTS));
    ClassroomState.activeStudentId = null;
  }
}

/**
 * saveClassroom() — Guarda el estado de la clase en localStorage y en Firebase Firestore.
 */
function saveClassroom() {
  // 1. Guardar localmente
  try {
    localStorage.setItem(CLASSROOM_KEY, JSON.stringify(ClassroomState));
  } catch (e) {
    console.warn('⚠️ No se pudo guardar la base en localStorage:', e.message);
  }

  // 2. Sincronizar en la nube de Firebase de forma asíncrona
  if (firebaseDb) {
    firebaseDb.collection("classrooms").doc("la-porota-course").set(ClassroomState)
      .then(() => console.log("🔥 Base del curso sincronizada en la nube de Firebase Firestore"))
      .catch(e => console.warn("⚠️ Error de sincronización en Firebase:", e.message));
  }
}

/**
 * selectStudent(studentId) — Selecciona al alumno activo, restaura su progreso y va a la pantalla de inicio.
 */
function selectStudent(studentId) {
  const student = ClassroomState.students.find(s => s.id === studentId);
  if (!student) return;

  ClassroomState.activeStudentId = studentId;
  saveClassroom();

  // Cargar progreso del alumno al GameState
  loadProgressOfStudent(student);

  // Mostrar pantalla de inicio
  showScreen('start');

  // Actualizar nombre del investigador en la UI si existe algún indicador
  const playerLabel = document.querySelector('.player-label');
  if (playerLabel) {
    playerLabel.textContent = student.name;
  }
  const playerIcon = document.querySelector('.player-icon');
  if (playerIcon) {
    playerIcon.textContent = student.avatar || '🕵️';
  }

  // Actualizar todo
  updateMap();
  updateUI();

  console.log(`🕵️ Investigador activo: ${student.name}`);
}

/**
 * loadProgressOfStudent(student) — Restaura las variables del juego con los datos del alumno.
 */
function loadProgressOfStudent(student) {
  GameState.completedMissions = student.completedMissions || [];
  GameState.score = student.score || 0;
  // Si las vidas son 0 (perdió en sesión anterior) o no existen, restaurar al máximo
  GameState.lives = (student.lives !== undefined && student.lives > 0) ? student.lives : GameState.maxLives;
  GameState.badges = student.badges || [];
  GameState.missionAttempts = student.attempts || {};
  GameState.unlockedRewards = student.unlockedRewards || [];
  GameState.activeMissionId = null;
  GameState.currentQuestionIndex = 0;
  GameState.isModalOpen = false;
  GameState.isProcessing = false;
}

/**
 * saveProgress() — Guarda el progreso del juego en el alumno activo y persiste todo.
 */
function saveProgress() {
  if (!ClassroomState.activeStudentId) return;

  const student = ClassroomState.students.find(s => s.id === ClassroomState.activeStudentId);
  if (!student) return;

  // Actualizar métricas del alumno
  student.score = GameState.score;
  student.completedMissions = GameState.completedMissions;
  student.lives = GameState.lives;
  student.badges = GameState.badges;
  student.attempts = GameState.missionAttempts;
  student.unlockedRewards = GameState.unlockedRewards;

  // Guardar en la base de datos centralizada
  saveClassroom();
  console.log(`💾 Progreso guardado para el alumno: ${student.name}`);
}

/**
 * loadProgress() — Requerido por la lógica de inicialización. Delegado a Classroom.
 */
function loadProgress() {
  if (ClassroomState.activeStudentId) {
    const student = ClassroomState.students.find(s => s.id === ClassroomState.activeStudentId);
    if (student) {
      loadProgressOfStudent(student);
    }
  }
}

/**
 * clearSavedProgress() — Al finalizar el juego (Victoria o Game Over),
 * resetea la sesión del estudiante para que pueda volver a jugar, pero conserva su nombre en el curso.
 */
function clearSavedProgress() {
  if (!ClassroomState.activeStudentId) return;

  const student = ClassroomState.students.find(s => s.id === ClassroomState.activeStudentId);
  if (!student) return;

  // Resetear estadísticas locales del estudiante pero mantener su ficha registrada
  student.score = 0;
  student.completedMissions = [];
  student.lives = GameState.maxLives;
  student.badges = [];
  student.attempts = {};
  student.unlockedRewards = [];

  saveClassroom();
  console.log(`🧹 Sesión de juego del alumno "${student.name}" reseteada para un nuevo intento.`);
}

// =============================================================================
// RENDERS DINÁMICOS DE ALUMNOS (SELECCIÓN Y PANEL)
// =============================================================================

/**
 * renderStudentsGrid() — Dibuja las tarjetas de los alumnos en la pantalla de selección.
 */
function renderStudentsGrid() {
  const grid = document.getElementById('students-grid');
  if (!grid) return;

  if (ClassroomState.students.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: rgba(255,255,255,0.6); font-family: var(--font-body); padding: 2rem;">No hay alumnos registrados. Crea uno con el botón de abajo. 🎒</div>`;
    return;
  }

  grid.innerHTML = ClassroomState.students.map(student => {
    const countMissions = student.completedMissions ? student.completedMissions.length : 0;
    const isActiveSession = student.id === ClassroomState.activeStudentId ? 'active-session' : '';
    
    return `
      <div class="student-card ${isActiveSession}" data-id="${student.id}">
        <div class="student-card-avatar">${student.avatar || '🕵️'}</div>
        <div class="student-card-name" title="${student.name}">${student.name}</div>
        <div class="student-card-stats">⭐ ${student.score || 0} pts</div>
        <div class="student-card-missions">${countMissions} / 5 Misiones</div>
      </div>
    `;
  }).join('');
}

// =============================================================================
// LÓGICA DEL PANEL DOCENTE (DASHBOARD)
// =============================================================================

/**
 * openDashboard() — Muestra el dashboard y calcula las estadísticas agregadas en tiempo real.
 */
function openDashboard() {
  const modal = document.getElementById('dashboard-modal');
  if (!modal) return;

  // 1. Calcular estadísticas agregadas
  const totalStudents = ClassroomState.students.length;
  document.getElementById('db-stat-total-students').textContent = totalStudents;

  // Promedio de puntaje
  let avgScore = 0;
  if (totalStudents > 0) {
    const totalScore = ClassroomState.students.reduce((sum, s) => sum + (s.score || 0), 0);
    avgScore = Math.round(totalScore / totalStudents);
  }
  document.getElementById('db-stat-avg-score').textContent = avgScore;

  // Misión más difícil (basada en el número total de intentos fallidos acumulados)
  let missionAttemptsSum = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ClassroomState.students.forEach(student => {
    if (student.attempts) {
      for (let mId = 1; mId <= 5; mId++) {
        missionAttemptsSum[mId] += (student.attempts[mId] || 0);
      }
    }
  });

  let hardestMissionId = null;
  let maxAttemptsCount = 0;
  for (let mId = 1; mId <= 5; mId++) {
    if (missionAttemptsSum[mId] > maxAttemptsCount) {
      maxAttemptsCount = missionAttemptsSum[mId];
      hardestMissionId = mId;
    }
  }

  const hardestMissionText = document.getElementById('db-stat-hardest-mission');
  if (hardestMissionText) {
    if (hardestMissionId && maxAttemptsCount > 0) {
      const names = [
        "Misión 1: Habitación",
        "Misión 2: Calles",
        "Misión 3: Casa de Mimí",
        "Misión 4: Carpintero",
        "Misión 5: Fábrica"
      ];
      hardestMissionText.textContent = `${names[hardestMissionId - 1]} (${maxAttemptsCount} err.)`;
    } else {
      hardestMissionText.textContent = "Ninguna (0 errores)";
    }
  }

  // 2. Renderizar tabla de alumnos
  const tbody = document.getElementById('dashboard-table-body');
  if (tbody) {
    if (totalStudents === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: rgba(255,255,255,0.5);">No hay alumnos registrados para mostrar en el dashboard.</td></tr>`;
    } else {
      tbody.innerHTML = ClassroomState.students.map(student => {
        const completed = student.completedMissions || [];
        const badgeList = student.badges || [];
        const attempts = student.attempts || {};

        // Generar insignias visuales
        const badgesHtml = badgeList.length > 0
          ? badgeList.map(bId => {
              const bData = GameState.questionsData ? GameState.questionsData.badges.find(badge => badge.id === bId) : null;
              return `<span class="db-badge-pill" title="${bData ? bData.name : bId}">${bData ? bData.icon : '🏅'}</span>`;
            }).join('')
          : '<em style="font-size:0.8rem; color:rgba(255,255,255,0.4)">Sin logros</em>';

        // Avance de misiones
        const missionsHtml = [1, 2, 3, 4, 5].map(mId => {
          const isDone = completed.includes(mId);
          return `<span class="db-mission-pill ${isDone ? 'done' : ''}">${isDone ? '✅ M' + mId : '🔒 M' + mId}</span>`;
        }).join(' ');

        // Intentos fallidos por misión
        const attemptsText = [1, 2, 3, 4, 5].map(mId => {
          const count = attempts[mId] || 0;
          return `M${mId}: <strong style="color: ${count > 1 ? '#FF6B6B' : '#fff'}">${count}</strong>`;
        }).join(' | ');

        return `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
            <td style="padding: 12px 15px; display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.5rem;">${student.avatar || '🕵️'}</span>
              <strong style="color: #FFD700;">${student.name}</strong>
            </td>
            <td style="padding: 12px 15px; font-weight: bold; color: var(--color-magic-blue-light);">⭐ ${student.score || 0}</td>
            <td style="padding: 12px 15px;">${missionsHtml}</td>
            <td style="padding: 12px 15px;">${badgesHtml}</td>
            <td style="padding: 12px 15px; font-family: monospace; font-size: 0.8rem;">${attemptsText}</td>
            <td style="padding: 12px 15px; text-align: center;">
              <button class="db-btn-delete" onclick="deleteStudentFromDb('${student.id}')" aria-label="Eliminar a ${student.name}">
                🗑️ Eliminar
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  modal.classList.add('active');
}

/**
 * closeDashboard() — Cierra el dashboard
 */
function closeDashboard() {
  const modal = document.getElementById('dashboard-modal');
  if (modal) modal.classList.remove('active');
}

// =============================================================================
// LÓGICA DE AGREGAR ESTUDIANTE
// =============================================================================

/**
 * openAddStudentModal() — Abre el modal de creación de estudiante
 */
function openAddStudentModal() {
  const modal = document.getElementById('add-student-modal');
  if (!modal) return;

  // Limpiar campos
  const input = document.getElementById('student-name-input');
  if (input) input.value = '';

  const avatarOpts = document.querySelectorAll('.avatar-option');
  avatarOpts.forEach(o => o.classList.remove('active'));
  const defaultAvatar = document.querySelector('.avatar-option[data-avatar="🕵️"]');
  if (defaultAvatar) defaultAvatar.classList.add('active');

  modal.classList.add('active');
}

/**
 * closeAddStudentModal() — Cierra el modal de creación
 */
function closeAddStudentModal() {
  const modal = document.getElementById('add-student-modal');
  if (modal) modal.classList.remove('active');
}

/**
 * handleAddStudentSubmit(e) — Procesa el formulario de nuevo alumno.
 */
function handleAddStudentSubmit(e) {
  e.preventDefault();

  const nameInput = document.getElementById('student-name-input');
  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) return;

  // Obtener avatar seleccionado
  const activeAvatarEl = document.querySelector('.avatar-option.active');
  const avatar = activeAvatarEl ? activeAvatarEl.dataset.avatar : '🕵️';

  // Generar ID único
  const id = 'student-' + Date.now();

  // Crear objeto alumno
  const newStudent = {
    id: id,
    name: name,
    avatar: avatar,
    score: 0,
    completedMissions: [],
    lives: GameState.maxLives,
    badges: [],
    unlockedRewards: [],
    attempts: {}
  };

  // Agregar al estado y guardar
  ClassroomState.students.push(newStudent);
  saveClassroom();

  // Actualizar grilla y cerrar
  renderStudentsGrid();
  closeAddStudentModal();

  // Si el panel docente está abierto, refrescarlo
  const dashboardModal = document.getElementById('dashboard-modal');
  if (dashboardModal && dashboardModal.classList.contains('active')) {
    openDashboard();
  }

  // Notificación de éxito
  showBadgeNotification({
    icon: avatar,
    name: '¡Investigador Creado!',
    description: `Bienvenido a bordo, ${name}.`
  });

  console.log(`🎒 Alumno creado con éxito: ${name} (${avatar})`);
}

/**
 * deleteStudentFromDb(studentId) — Elimina un alumno del listado central.
 * Nota: Se define globalmente para que funcione con el onclick del HTML.
 */
window.deleteStudentFromDb = function(studentId) {
  const student = ClassroomState.students.find(s => s.id === studentId);
  if (!student) return;

  const confirmed = confirm(`¿Estás seguro de que deseas eliminar al investigador "${student.name}"? Perderá todo su progreso.`);
  if (!confirmed) return;

  // Quitar de la lista
  ClassroomState.students = ClassroomState.students.filter(s => s.id !== studentId);

  // Si era el estudiante activo, deseleccionarlo
  if (ClassroomState.activeStudentId === studentId) {
    ClassroomState.activeStudentId = null;
  }

  saveClassroom();
  renderStudentsGrid();

  // Refrescar Dashboard
  openDashboard();
  console.log(`🗑️ Investigador eliminado: ${student.name}`);
};

/**
 * resetClassroom() — Reinicia las métricas de todos los alumnos de la clase al estado inicial.
 */
function resetClassroom() {
  const confirmed = confirm("⚠️ ATENCIÓN: ¿Estás seguro de que deseas reiniciar el progreso de TODO el curso? Todos los alumnos volverán a 0 puntos y sus misiones se bloquearán. Esta acción no se puede deshacer.");
  if (!confirmed) return;

  ClassroomState.students.forEach(student => {
    student.score = 0;
    student.completedMissions = [];
    student.lives = GameState.maxLives;
    student.badges = [];
    student.attempts = {};
    student.unlockedRewards = [];
  });

  // Si había sesión activa, resetearla en el juego
  if (ClassroomState.activeStudentId) {
    const active = ClassroomState.students.find(s => s.id === ClassroomState.activeStudentId);
    if (active) loadProgressOfStudent(active);
  }

  saveClassroom();
  renderStudentsGrid();
  openDashboard();

  alert("🔄 El progreso del curso ha sido reiniciado por completo.");
  console.log("🔄 El progreso del curso ha sido reiniciado.");
}

// =============================================================================
// SINTETIZADOR RETRO DE MÚSICA DE 8 BITS (CHIPTUNE ARCADE)
// =============================================================================

const RetroSynth = {
  ctx: null,
  gain: null,
  isPlaying: false,
  intervalId: null,
  noteIndex: 0,
  
  // Melodía arpegiada nostálgica inspirada en clásicos de 8 bits
  melody: [
    // Lam (Nostálgico y misterioso)
    { freq: 220.00, dur: 0.28 }, // A3
    { freq: 261.63, dur: 0.28 }, // C4
    { freq: 329.63, dur: 0.28 }, // E4
    { freq: 440.00, dur: 0.50 }, // A4
    
    // Rem (Melancólico)
    { freq: 293.66, dur: 0.28 }, // D4
    { freq: 349.23, dur: 0.28 }, // F4
    { freq: 440.00, dur: 0.28 }, // A4
    { freq: 587.33, dur: 0.50 }, // D5
    
    // Solm (Aventurero)
    { freq: 196.00, dur: 0.28 }, // G3
    { freq: 293.66, dur: 0.28 }, // D4
    { freq: 392.00, dur: 0.28 }, // G4
    { freq: 466.16, dur: 0.50 }, // Bb4
    
    // Do (Alegre resolución)
    { freq: 261.63, dur: 0.28 }, // C4
    { freq: 329.63, dur: 0.28 }, // E4
    { freq: 392.00, dur: 0.28 }, // G4
    { freq: 523.25, dur: 0.50 }  // C5
  ],
  
  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.gain = this.ctx.createGain();
    // Volumen de fondo del 36%
    this.gain.gain.value = 0.36;
    this.gain.connect(this.ctx.destination);
  },
  
  start() {
    this.init();
    if (this.isPlaying) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    this.isPlaying = true;
    this.noteIndex = 0;
    
    // Tocar primera nota de inmediato
    this.playNote();
    
    // Intervalo de reproducción a ritmo constante (380ms por nota para una cadencia suave)
    this.intervalId = setInterval(() => {
      this.playNote();
    }, 380);
  },
  
  stop() {
    if (!this.isPlaying) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isPlaying = false;
  },
  
  playNote() {
    if (!this.isPlaying || !this.ctx) return;
    const note = this.melody[this.noteIndex];
    this.noteIndex = (this.noteIndex + 1) % this.melody.length;
    
    // Crear osciladores 8 bits
    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();
    
    // Usamos onda de tipo triángulo porque es mucho más suave, dulce y cálida
    // en comparación con la onda cuadrada, evitando la fatiga auditiva en niños.
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(note.freq, this.ctx.currentTime);
    
    // Envolvente de volumen (Fade-in rápido y Fade-out suave) para una sensación orgánica
    noteGain.gain.setValueAtTime(0, this.ctx.currentTime);
    noteGain.gain.linearRampToValueAtTime(0.36, this.ctx.currentTime + 0.04);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + note.dur);
    
    osc.connect(noteGain);
    noteGain.connect(this.gain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + note.dur);
  },
  
  toggle() {
    const soundIcon = document.getElementById('sound-icon');
    if (this.isPlaying) {
      this.stop();
      if (soundIcon) soundIcon.textContent = '🔇';
    } else {
      this.start();
      if (soundIcon) soundIcon.textContent = '🔊';
    }
  }
};

// =============================================================================
// ARRANQUE
// =============================================================================

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
