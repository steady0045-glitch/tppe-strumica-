// Иста Firebase конфигурација како мобилната апликација (јавна веб-конфигурација).
// Истиот проект = истата база и истата синхронизација.
const firebaseConfig = {
  apiKey: "AIzaSyB6yZwW88e6pNEuoy0M6yAFv_5v_7G8_HM",
  authDomain: "tppestrumica-859e5.firebaseapp.com",
  projectId: "tppestrumica-859e5",
  storageBucket: "tppestrumica-859e5.firebasestorage.app",
  messagingSenderId: "569570752369",
  appId: "1:569570752369:web:eb7d3bf12365296e5928d0",
  measurementId: "G-P8P0ND72H8"
};
if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
window.tppeDb = firebase.firestore();
