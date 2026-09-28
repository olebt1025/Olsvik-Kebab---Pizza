import { db } from "./firebase-config.js";
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    query, 
    where, 
    orderBy,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM-elementer for Karusell
const bannerInnhold = document.getElementById("banner-innhold");
const forrigeBtn = document.getElementById("forrige-banner-btn");
const nesteBtn = document.getElementById("neste-banner-btn");
const indikatorerContainer = document.getElementById("karusell-indikatorer");

// DOM-elementer for Meny og Handlekurv
const kategoriKnapper = document.querySelectorAll(".kategori-btn");
const menyVisning = document.getElementById("meny-visning");
const handlekurvInnhold = document.getElementById("handlekurv-innhold");
const sendBestillingBtn = document.getElementById("send-bestilling-btn");

// DOM-elementer for Skjema og Kvittering Modal
const bestillingModal = document.getElementById("bestilling-modal");
const bestillingForm = document.getElementById("bestilling-form");
const avbrytBestillingBtn = document.getElementById("avbryt-bestilling-btn");
const adresseContainer = document.getElementById("adresse-container");
const kundeAdresseInput = document.getElementById("kunde-adresse");

const kvitteringModal = document.getElementById("kvittering-modal");
const kvitteringOrdreId = document.getElementById("kvittering-ordre-id");
const kvitteringOppsummering = document.getElementById("kvittering-oppsummering");
const lukkKvitteringBtn = document.getElementById("lukk-kvittering-btn");

const aktivOrdreBanner = document.getElementById("aktiv-ordre-banner");
const visKvitteringBtn = document.getElementById("vis-kvittering-btn");
const aktivOrdreIdKort = document.getElementById("aktiv-ordre-id-kort");

// Global tilstand
let aktiveBannere = [];
let gjeldendeBannerIndeks = 0;
let karusellTimer = null;
let handlekurv = [];

// INITIALISERING
hentAktiveBannere();
sjekkEksisterendeOrdre();

// Event-listeners for skjema-modal
sendBestillingBtn.addEventListener("click", opneBestillingModal);
avbrytBestillingBtn.addEventListener("click", lukkBestillingModal);
bestillingForm.addEventListener("submit", handterFormInnsending);
lukkKvitteringBtn.addEventListener("click", lukkKvitteringModal);
visKvitteringBtn.addEventListener("click", opneKvitteringModal);

// Radioknapper for type levering
document.querySelectorAll('input[name="leveringstype"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
        if (e.target.value === "levering") {
            adresseContainer.style.display = "block";
            kundeAdresseInput.required = true;
        } else {
            adresseContainer.style.display = "none";
            kundeAdresseInput.required = false;
        }
    });
});

// ==========================================
// KARUSELL-LOGIKK (3 sekunder rotering)
// ==========================================

async function hentAktiveBannere() {
    try {
        const q = query(collection(db, "banners"), where("aktiv", "==", true));
        const snapshot = await getDocs(q);
        
        aktiveBannere = [];
        snapshot.forEach(docSnap => {
            aktiveBannere.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (aktiveBannere.length === 0) {
            bannerInnhold.innerHTML = "<p>Ingen aktuelt tilbud akkurat nå.</p>";
            return;
        }

        visBanner(0);
        opprettIndikatorer();
        startKarusell();

    } catch (error) {
        console.error("Feil ved henting av tilbud:", error);
        bannerInnhold.innerHTML = "<p>Kunne ikke laste tilbud.</p>";
    }
}

function visBanner(indeks) {
    if (aktiveBannere.length === 0) return;

    gjeldendeBannerIndeks = indeks;
    const banner = aktiveBannere[gjeldendeBannerIndeks];

    bannerInnhold.innerHTML = `
        <div class="banner-kort" style="cursor: ${banner.kobletRettId ? 'pointer' : 'default'};">
            <img src="${banner.bildeUrl}" alt="${banner.tittel}" style="max-height: 180px; width: 100%; object-fit: cover;">
            <h3>${banner.tittel}</h3>
            <p>${banner.tekst || ''}</p>
            ${banner.kobletRettId ? '<small><em>Klikk her for å legge tilbudet i handlekurven!</em></small>' : ''}
        </div>
    `;

    const kort = bannerInnhold.querySelector(".banner-kort");
    if (banner.kobletRettId) {
        kort.addEventListener("click", () => leggKobletRettIHandlekurv(banner.kobletRettId));
    }

    oppdaterIndikatorer();
}

function startKarusell() {
    stoppKarusell();
    if (aktiveBannere.length <= 1) return;

    karusellTimer = setInterval(() => {
        const nesteIndeks = (gjeldendeBannerIndeks + 1) % aktiveBannere.length;
        visBanner(nesteIndeks);
    }, 3000);
}

function stoppKarusell() {
    if (karusellTimer) {
        clearInterval(karusellTimer);
    }
}

forrigeBtn.addEventListener("click", () => {
    const forrigeIndeks = (gjeldendeBannerIndeks - 1 + aktiveBannere.length) % aktiveBannere.length;
    visBanner(forrigeIndeks);
    startKarusell();
});

nesteBtn.addEventListener("click", () => {
    const nesteIndeks = (gjeldendeBannerIndeks + 1) % aktiveBannere.length;
    visBanner(nesteIndeks);
    startKarusell();
});

function opprettIndikatorer() {
    indikatorerContainer.innerHTML = "";
    aktiveBannere.forEach((_, i) => {
        const prikk = document.createElement("span");
        prikk.className = "indikator-prikk";
        prikk.addEventListener("click", () => {
            visBanner(i);
            startKarusell();
        });
        indikatorerContainer.appendChild(prikk);
    });
}

function oppdaterIndikatorer() {
    const prikker = indikatorerContainer.querySelectorAll(".indikator-prikk");
    prikker.forEach((prikk, i) => {
        if (i === gjeldendeBannerIndeks) {
            prikk.classList.add("aktiv");
        } else {
            prikk.classList.remove("aktiv");
        }
    });
}

async function leggKobletRettIHandlekurv(rettId) {
    try {
        const docRef = doc(db, "meny", rettId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const rett = { id: docSnap.id, ...docSnap.data() };
            leggIHandlekurv(rett);
        }
    } catch (error) {
        console.error("Feil ved henting av tilbudsrett:", error);
    }
}

// ==========================================
// MENY & HANDLEKURV LOGIKK
// ==========================================

kategoriKnapper.forEach(knapp => {
    knapp.addEventListener("click", () => {
        const kategori = knapp.dataset.kategori;
        hentMenyForKategori(kategori);
    });
});

async function hentMenyForKategori(kategori) {
    menyVisning.innerHTML = "<p>Laster meny...</p>";

    try {
        const q = query(
            collection(db, "meny"), 
            where("kategori", "==", kategori),
            orderBy("sortering", "asc")
        );

        const snapshot = await getDocs(q);
        menyVisning.innerHTML = "";

        if (snapshot.empty) {
            menyVisning.innerHTML = "<p>Ingen retter i denne kategorien.</p>";
            return;
        }

        snapshot.forEach(docSnap => {
            const rett = { id: docSnap.id, ...docSnap.data() };

            const kort = document.createElement("div");
            kort.className = "meny-kort";
            
            kort.innerHTML = `
                ${rett.bildeUrl ? `<img src="${rett.bildeUrl}" alt="${rett.navn}" class="rett-bilde" style="width: 100%; max-height: 150px; object-fit: cover; border-radius: 6px; margin-bottom: 8px;">` : ''}
                <div>
                    <strong>${rett.nummer ? 'Nr. ' + rett.nummer + ' - ' : ''}${rett.navn}</strong>
                    <p>${rett.beskrivelse || ''}</p>
                    <span>${rett.pris} kr</span>
                </div>
                <button class="legg-til-btn">Legg til</button>
            `;

            kort.querySelector(".legg-til-btn").addEventListener("click", () => leggIHandlekurv(rett));
            menyVisning.appendChild(kort);
        });

    } catch (error) {
        console.error("Feil ved henting av meny:", error);
        menyVisning.innerHTML = "<p>Kunne ikke laste menyen.</p>";
    }
}

function leggIHandlekurv(rett) {
    handlekurv.push(rett);
    oppdaterHandlekurvVisning();
}

function oppdaterHandlekurvVisning() {
    if (handlekurv.length === 0) {
        handlekurvInnhold.innerHTML = "<p>Handlekurven er tom.</p>";
        sendBestillingBtn.disabled = true;
        return;
    }

    let totalPris = 0;
    handlekurvInnhold.innerHTML = "";

    handlekurv.forEach((rett, indeks) => {
        totalPris += rett.pris;

        const rad = document.createElement("div");
        rad.className = "handlekurv-rad";
        rad.innerHTML = `
            <span>${rett.navn} - ${rett.pris} kr</span>
            <button class="fjern-btn">Fjern</button>
        `;

        rad.querySelector(".fjern-btn").addEventListener("click", () => {
            handlekurv.splice(indeks, 1);
            oppdaterHandlekurvVisning();
        });

        handlekurvInnhold.appendChild(rad);
    });

    const totalElement = document.createElement("div");
    totalElement.className = "handlekurv-total";
    totalElement.innerHTML = `<strong>Total: ${totalPris} kr</strong>`;
    handlekurvInnhold.appendChild(totalElement);

    sendBestillingBtn.disabled = false;
}

// ==========================================
// MODAL- OG BESTILLINGSLOGIKK (Ingen Alerts)
// ==========================================

function opneBestillingModal() {
    if (handlekurv.length === 0) return;
    bestillingModal.style.display = "flex";
}

function lukkBestillingModal() {
    bestillingModal.style.display = "none";
}

async function handterFormInnsending(e) {
    e.preventDefault();

    const kundenavn = document.getElementById("kunde-navn").value.trim();
    const telefon = document.getElementById("kunde-tlf").value.trim();
    const leveringstype = document.querySelector('input[name="leveringstype"]:checked').value;
    const adresse = leveringstype === "levering" ? kundeAdresseInput.value.trim() : "";

    const totalPris = handlekurv.reduce((sum, rett) => sum + rett.pris, 0);

    const submitBtn = document.getElementById("bekreft-bestilling-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sender bestilling...";

    try {
        const docRef = await addDoc(collection(db, "bestillinger"), {
            kundenavn: kundenavn,
            telefon: telefon,
            type: leveringstype,
            adresse: adresse,
            retter: handlekurv,
            totalPris: totalPris,
            status: "ny",
            opprettetDato: serverTimestamp()
        });

        const kortOrdreId = docRef.id.slice(-4).toUpperCase();
        
        // Lagre i localStorage i 3 timer uten å slette ved ny bestilling
        const bestillingsData = {
            id: kortOrdreId,
            fullId: docRef.id,
            retter: handlekurv,
            totalPris: totalPris,
            leveringstype: leveringstype,
            tidspunkt: Date.now()
        };
        localStorage.setItem("siste_bestilling", JSON.stringify(bestillingsData));

        // Tøm handlekurv og lukk skjema
        handlekurv = [];
        oppdaterHandlekurvVisning();
        lukkBestillingModal();
        bestillingForm.reset();

        // Vis kvittering
        visKvitteringForOrdre(bestillingsData);

    } catch (error) {
        console.error("Feil ved sending av bestilling:", error);
        alert("Kunne ikke sende bestillingen. Prøv igjen.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Bekreft og send";
    }
}

// ==========================================
// LOCALSTORAGE OG KVITTERING (3 timer utløp)
// ==========================================

function sjekkEksisterendeOrdre() {
    const lagret = localStorage.getItem("siste_bestilling");
    if (!lagret) return;

    try {
        const data = JSON.parse(lagret);
        const treTimerMS = 3 * 60 * 60 * 1000;

        // Sjekk om det har gått mer enn 3 timer
        if (Date.now() - data.tidspunkt > treTimerMS) {
            localStorage.removeItem("siste_bestilling");
            aktivOrdreBanner.style.display = "none";
        } else {
            // Viser knapp i header om aktiv ordre
            aktivOrdreIdKort.textContent = data.id;
            aktivOrdreBanner.style.display = "block";
        }
    } catch (err) {
        localStorage.removeItem("siste_bestilling");
    }
}

function visKvitteringForOrdre(data) {
    kvitteringOrdreId.textContent = `#${data.id}`;
    
    let retterHTML = "<ul>";
    data.retter.forEach(r => {
        retterHTML += `<li>${r.navn} (${r.pris} kr)</li>`;
    });
    retterHTML += "</ul>";

    kvitteringOppsummering.innerHTML = `
        <p><strong>Måte:</strong> ${data.leveringstype === 'levering' ? '🚗 Utkjøring' : '🛍️ Henting'}</p>
        <p><strong>Bestilte varer:</strong></p>
        ${retterHTML}
        <p><strong>Total: ${data.totalPris} kr</strong></p>
    `;

    sjekkEksisterendeOrdre();
}

function opneKvitteringModal() {
    const lagret = localStorage.getItem("siste_bestilling");
    if (lagret) {
        visKvitteringForOrdre(JSON.parse(lagret));
    }
    kvitteringModal.style.display = "flex";
}

function lukkKvitteringModal() {
    kvitteringModal.style.display = "none";
}