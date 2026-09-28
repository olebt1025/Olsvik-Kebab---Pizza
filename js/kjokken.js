import { db } from "./firebase-config.js";
import { 
    collection, 
    onSnapshot, 
    doc, 
    updateDoc, 
    query, 
    where,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { 
    getAuth, 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// TILGANGSKONTROLL / INNLOGGINGSSJEKK
// ==========================================
const auth = getAuth();

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    }
});

// Utlogging
const loggutBtn = document.getElementById("loggut-btn");
if (loggutBtn) {
    loggutBtn.addEventListener("click", () => signOut(auth));
}

// DOM-elementer
const listeNy = document.getElementById("liste-ny");
const listeLager = document.getElementById("liste-lager");
const listeKlar = document.getElementById("liste-klar");

// Lytter på aktive bestillinger i sanntid
startOrdreLytter();

function startOrdreLytter() {
    const q = query(
        collection(db, "bestillinger"), 
        where("status", "in", ["ny", "under_tilberedning", "klar"]),
        orderBy("opprettetDato", "asc")
    );

    onSnapshot(q, (snapshot) => {
        listeNy.innerHTML = "";
        listeLager.innerHTML = "";
        listeKlar.innerHTML = "";

        if (snapshot.empty) {
            listeNy.innerHTML = "<p>Ingen aktive bestillinger.</p>";
            return;
        }

        snapshot.forEach((docSnap) => {
            const ordre = { id: docSnap.id, ...docSnap.data() };
            tegnOrdreKort(ordre);
        });
    }, (error) => {
        console.error("Feil ved lytting på bestillinger:", error);
    });
}

function tegnOrdreKort(ordre) {
    const kort = document.createElement("div");
    kort.className = `ordre-kort status-${ordre.status}`;

    const tid = ordre.opprettetDato ? new Date(ordre.opprettetDato.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--";
    const leveringTekst = ordre.leveringstype === "levering" || ordre.type === "levering" ? "🚗 Utkjøring" : "🛍️ Henting";

    let retterHTML = "";
    if (ordre.retter && Array.isArray(ordre.retter)) {
        retterHTML = ordre.retter.map(r => `<li>${r.navn} (${r.pris} kr)</li>`).join("");
    }

    kort.innerHTML = `
        <div class="ordre-header">
            <strong>Ordre #${ordre.id.slice(-4).toUpperCase()}</strong>
            <span>${tid}</span>
        </div>
        <p class="ordre-type"><strong>${leveringTekst}</strong></p>
        
        <div class="kunde-info">
            <p><strong>Kunde:</strong> ${ordre.kundenavn || 'Anonym'}</p>
            <p><strong>Tlf:</strong> <a href="tel:${ordre.telefon}">${ordre.telefon || 'Ikke oppgitt'}</a></p>
            ${(ordre.leveringstype === "levering" || ordre.type === "levering") ? `<p><strong>Adresse:</strong> ${ordre.adresse || 'Ikke oppgitt'}</p>` : ''}
        </div>

        <ul class="ordre-retter">
            ${retterHTML}
        </ul>

        <p class="ordre-total"><strong>Total:</strong> ${ordre.totalPris || 0} kr</p>
        
        <div class="ordre-handlinger">
            ${genererKnapperHTML(ordre.status, ordre.id, ordre.leveringstype || ordre.type)}
        </div>
    `;

    leggTilKnappLyttere(kort, ordre.id);

    if (ordre.status === "ny") listeNy.appendChild(kort);
    else if (ordre.status === "under_tilberedning") listeLager.appendChild(kort);
    else if (ordre.status === "klar") listeKlar.appendChild(kort);
}

function genererKnapperHTML(status, id, type) {
    if (status === "ny") {
        return `<button class="btn-status" data-id="${id}" data-neste="under_tilberedning">Start laget</button>`;
    } else if (status === "under_tilberedning") {
        return `<button class="btn-status" data-id="${id}" data-neste="klar">Markér klar</button>`;
    } else if (status === "klar") {
        const fullfortTekst = type === "levering" ? "Send til utkjøring" : "Markér utlevert / fullført";
        return `<button class="btn-status btn-fullfor" data-id="${id}" data-neste="${type === 'levering' ? 'klar_for_levering' : 'fullført'}">${fullfortTekst}</button>`;
    }
    return "";
}

function leggTilKnappLyttere(kort, ordreId) {
    const knapper = kort.querySelectorAll(".btn-status");
    knapper.forEach(knapp => {
        knapp.addEventListener("click", async () => {
            const nyStatus = knapp.dataset.neste;
            await oppdaterOrdreStatus(ordreId, nyStatus);
        });
    });
}

async function oppdaterOrdreStatus(ordreId, nyStatus) {
    try {
        const ordreRef = doc(db, "bestillinger", ordreId);
        await updateDoc(ordreRef, {
            status: nyStatus
        });
    } catch (error) {
        console.error("Feil ved oppdatering av status:", error);
        alert("Kunne ikke oppdatere status. Prøv igjen.");
    }
}