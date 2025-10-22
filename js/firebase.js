// Inicialização do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAza98u8-NVn9hNbuLwcsaCZX2hXbtVaHk",
  authDomain: "meu-app-de-login.firebaseapp.com",
  projectId: "meu-app-de-login",
  storageBucket: "meu-app-de-login.firebasestorage.app",
  messagingSenderId: "61119567504",
  appId: "1:61119567504:web:556bb893c9eba6c4e12a15"
};

// Inicializa o app
firebase.initializeApp(firebaseConfig);

// Conexões principais
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.app().functions("southamerica-east1");
