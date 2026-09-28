// Firebase-konfigurasjon

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB-GvKK5_FtJmLk1Jr95PghX9MeopMVKYY",
    authDomain: "olsvik-kebab-og-pizza.firebaseapp.com",
    projectId: "olsvik-kebab-og-pizza",
    storageBucket: "olsvik-kebab-og-pizza.firebasestorage.app",
    messagingSenderId: "310018267716",
    appId: "1:310018267716:web:1234567890abcdef",
    measurementId: "G-V9BY4JVBXE"
};

// initialiser Firebase
const app = initializeApp(firebaseConfig);

//eksporterer firestore - databasen så andre JS-filer kan bruke den
export const db = getFirestore(app);

