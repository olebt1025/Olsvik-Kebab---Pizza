import { 
    getAuth, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const auth = getAuth();

const loginForm = document.getElementById("login-form");
const epostInput = document.getElementById("epost");
const passordInput = document.getElementById("passord");
const feilMelding = document.getElementById("feil-melding");

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    feilMelding.style.display = "none";

    try {
        await signInWithEmailAndPassword(auth, epostInput.value.trim(), passordInput.value);
        window.location.href = "kjokken.html";
    } catch (error) {
        console.error("Innloggingsfeil:", error);
        feilMelding.style.display = "block";
        feilMelding.textContent = "Feil e-post eller passord.";
    }
});