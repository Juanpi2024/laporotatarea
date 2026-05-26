// =============================================================================
// CONFIGURACIÓN DE FIREBASE PARA LA POROTA
// =============================================================================
// Reemplaza este objeto con tus propias credenciales de Firebase Console.
// Para obtenerlas:
// 1. Ve a https://console.firebase.google.com/
// 2. Crea un proyecto de Firebase e integra una aplicación Web.
// 3. Habilita "Cloud Firestore" en tu base de datos (puedes iniciar en modo de prueba).
// 4. Copia las credenciales en este objeto:

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT_ID.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT_ID.appspot.com",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

// Cambia esta variable a true para activar Firebase Firestore como base de datos central.
// Si está en true pero las credenciales no son válidas o no hay conexión de red,
// el juego volverá AUTOMÁTICAMENTE a localStorage para que nunca deje de funcionar.
const USE_FIREBASE = false;
