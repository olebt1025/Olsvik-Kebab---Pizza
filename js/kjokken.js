import { db } from "./firebase-config.js";
import { 
    collection, 
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteField,
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
        window.location.replace("index.html");
        return;
    }

    document.body.classList.remove("auth-pending");
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
const listeUtkjoring = document.getElementById("liste-utkjoring");

// Lytter på aktive bestillinger i sanntid
startOrdreLytter();

function startOrdreLytter() {
    const q = query(
        collection(db, "bestillinger"), 
        where("status", "in", ["ny", "under_tilberedning", "klar", "klar_for_levering"]),
        orderBy("opprettetDato", "asc")
    );

    onSnapshot(q, (snapshot) => {
        listeNy.innerHTML = "";
        listeLager.innerHTML = "";
        listeKlar.innerHTML = "";
        listeUtkjoring.innerHTML = "";

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
    kort.className = `ordre-kort status-${["ny", "under_tilberedning", "klar", "klar_for_levering"].includes(ordre.status) ? ordre.status : "ny"}`;

    const tid = ordre.opprettetDato ? new Date(ordre.opprettetDato.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--";
    const leveringTekst = ordre.leveringstype === "levering" || ordre.type === "levering" ? "🚗 Utkjøring" : "🛍️ Henting";

    const header = document.createElement("div");
    header.className = "ordre-header";
    const orderId = document.createElement("strong");
    orderId.textContent = `Ordre #${ordre.id.slice(-4).toUpperCase()}`;
    const time = document.createElement("span");
    time.textContent = tid;
    header.append(orderId, time);

    const type = document.createElement("p");
    type.className = "ordre-type";
    const typeText = document.createElement("strong");
    typeText.textContent = leveringTekst;
    type.appendChild(typeText);

    const kundeInfo = document.createElement("div");
    kundeInfo.className = "kunde-info";
    const leggTilKundeInfo = (etikett, verdi) => {
        const avsnitt = document.createElement("p");
        const sterk = document.createElement("strong");
        sterk.textContent = `${etikett}: `;
        avsnitt.append(sterk, verdi);
        kundeInfo.appendChild(avsnitt);
    };
    leggTilKundeInfo("Kunde", ordre.kundenavn || "Anonym");

    const telefon = ordre.telefon || "Ikke oppgitt";
    const telefonLenke = document.createElement("a");
    telefonLenke.href = `tel:${telefon}`;
    telefonLenke.textContent = telefon;
    const telefonAvsnitt = document.createElement("p");
    const telefonEtikett = document.createElement("strong");
    telefonEtikett.textContent = "Tlf: ";
    telefonAvsnitt.append(telefonEtikett, telefonLenke);
    kundeInfo.appendChild(telefonAvsnitt);

    if (ordre.leveringstype === "levering" || ordre.type === "levering") {
        leggTilKundeInfo("Adresse", ordre.adresse || "Ikke oppgitt");
    }

    const retterListe = document.createElement("ul");
    retterListe.className = "ordre-retter";
    if (Array.isArray(ordre.retter)) {
        ordre.retter.forEach(rett => {
            const vare = document.createElement("li");
            const mengde = Number.isInteger(rett.antall) && rett.antall > 1 ? `${rett.antall} x ` : "";
            vare.textContent = `${mengde}${rett.navn} (${rett.pris} kr)`;
            retterListe.appendChild(vare);
        });
    }

    const total = document.createElement("p");
    total.className = "ordre-total";
    const totalTekst = document.createElement("strong");
    totalTekst.textContent = `Total: ${ordre.totalPris || 0} kr`;
    total.appendChild(totalTekst);

    const handlinger = document.createElement("div");
    handlinger.className = "ordre-handlinger";
    const statusKnapp = genererStatusKnapp(ordre.status, ordre.leveringstype || ordre.type);
    if (statusKnapp) handlinger.appendChild(statusKnapp);

    kort.append(header, type, kundeInfo, retterListe, total, handlinger);

    leggTilKnappLyttere(kort, ordre.id);

    if (ordre.status === "ny") listeNy.appendChild(kort);
    else if (ordre.status === "under_tilberedning") listeLager.appendChild(kort);
    else if (ordre.status === "klar") listeKlar.appendChild(kort);
    else if (ordre.status === "klar_for_levering") listeUtkjoring.appendChild(kort);
}

function genererStatusKnapp(status, type) {
    const knapp = document.createElement("button");
    knapp.className = "btn-status";

    if (status === "ny") {
        knapp.dataset.neste = "under_tilberedning";
        knapp.textContent = "Start laget";
    } else if (status === "under_tilberedning") {
        knapp.dataset.neste = "klar";
        knapp.textContent = "Markér klar";
    } else if (status === "klar_for_levering") {
        knapp.classList.add("btn-fullfor");
        knapp.dataset.neste = "fullført";
        knapp.textContent = "Markér levert";
    } else if (status === "klar") {
        if (type === "levering") {
            knapp.dataset.neste = "klar_for_levering";
            knapp.textContent = "Send til utkjøring";
        } else {
            knapp.classList.add("btn-fullfor");
            knapp.dataset.neste = "fullført";
            knapp.textContent = "Markér utlevert / fullført";
        }
    } else {
        return null;
    }

    return knapp;
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
        const oppdatering = { status: nyStatus };
        if (nyStatus === "fullført") {
            oppdatering.kundenavn = deleteField();
            oppdatering.telefon = deleteField();
            oppdatering.adresse = deleteField();
        }
        await updateDoc(ordreRef, oppdatering);
    } catch (error) {
        console.error("Feil ved oppdatering av status:", error);
        alert("Kunne ikke oppdatere status. Prøv igjen.");
    }
}