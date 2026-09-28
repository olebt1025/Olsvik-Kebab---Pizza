import { db } from "./firebase-config.js";
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy,
    Timestamp 
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
const historikkListeContainer = document.getElementById("historikk-liste-container");
const kategoriKnapper = document.querySelectorAll(".kategori-btn");
const valgtKategoriTittel = document.getElementById("valgt-kategori-tittel");
const visSkjemaBtn = document.getElementById("vis-legg-til-skjema-btn");
const skjemaContainer = document.getElementById("skjema-container");
const skjemaTittel = document.getElementById("skjema-tittel");
const rettForm = document.getElementById("rett-form");
const avbrytBtn = document.getElementById("avbryt-skjema-btn");
const rettListeContainer = document.getElementById("admin-rett-liste");

// Skjema-felt
const rettIdInput = document.getElementById("rett-id");
const rettNummerInput = document.getElementById("rett-nummer");
const rettNavnInput = document.getElementById("rett-navn");
const rettPrisInput = document.getElementById("rett-pris");
const rettBildeFilInput = document.getElementById("rett-bilde-fil");
const rettSorteringInput = document.getElementById("rett-sortering");
const rettBeskrivelseInput = document.getElementById("rett-beskrivelse");

const visNyttBannerBtn = document.getElementById("vis-nytt-banner-skjema-btn");
const bannerSkjemaContainer = document.getElementById("banner-skjema-container");
const bannerForm = document.getElementById("banner-form");
const avbrytBannerBtn = document.getElementById("avbryt-banner-skjema-btn");
const bannerListeContainer = document.getElementById("admin-banner-liste");
const bannerKobletRettSelect = document.getElementById("banner-koblet-rett");

const bannerIdInput = document.getElementById("banner-id");
const bannerTittelInput = document.getElementById("banner-tittel");
const bannerTekstInput = document.getElementById("banner-tekst");
const bannerBildeUrlInput = document.getElementById("banner-bilde-url");
const bannerAktivCheckbox = document.getElementById("banner-aktiv");

let aktivKategori = "";
let eksisterendeBildeUrl = "";

// Komprimerer bilde til Base64
function komprimerBilde(fil) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(fil);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const maxBredde = 600;
                const skala = maxBredde / img.width;
                
                if (skala < 1) {
                    canvas.width = maxBredde;
                    canvas.height = img.height * skala;
                } else {
                    canvas.width = img.width;
                    canvas.height = img.height;
                }

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.7));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// Initialisering ved oppstart
hentHistorikkSiste12Timer();
fyllKobletRettDropdown();
hentAlleBannere();

// ==========================================
// HISTORIKKLOGIKK (Siste 12 timer)
// ==========================================

async function hentHistorikkSiste12Timer() {
    historikkListeContainer.innerHTML = "<p>Laster historikk...</p>";

    try {
        const tolvTimerSiden = Timestamp.fromDate(new Date(Date.now() - 12 * 60 * 60 * 1000));
        
        const q = query(
            collection(db, "bestillinger"),
            where("opprettetDato", ">=", tolvTimerSiden),
            orderBy("opprettetDato", "desc")
        );

        const snapshot = await getDocs(q);
        historikkListeContainer.innerHTML = "";

        if (snapshot.empty) {
            historikkListeContainer.innerHTML = "<p>Ingen bestillinger de siste 12 timene.</p>";
            return;
        }

        snapshot.forEach(docSnap => {
            const ordre = docSnap.data();
            const fullId = docSnap.id;
            const kortId = fullId.slice(-4).toUpperCase();

            // Tidspunkt-formatering
            let tidTekst = "Ukjent tid";
            if (ordre.opprettetDato) {
                const datoObj = ordre.opprettetDato.toDate();
                tidTekst = datoObj.toLocaleTimeString("no-NO", { hour: '2-digit', minute: '2-digit' });
            }

            // Vareliste-oppsummering
            let retterTekst = ordre.retter ? ordre.retter.map(r => r.navn).join(", ") : "Ingen varer";

            const kort = document.createElement("details");
            kort.style.background = "#fff";
            kort.style.border = "1px solid #ddd";
            kort.style.marginBottom = "8px";
            kort.style.padding = "8px 12px";
            kort.style.borderRadius = "4px";

            kort.innerHTML = `
                <summary style="cursor: pointer; font-weight: bold; display: flex; justify-content: space-between;">
                    <span>#${kortId} - ${ordre.kundenavn || 'Ukjent'} (${tidTekst})</span>
                    <span style="color: #666;">${ordre.totalPris || 0} kr | Status: ${ordre.status || 'ny'}</span>
                </summary>
                <div style="margin-top: 10px; font-size: 0.9em; border-top: 1px solid #eee; padding-top: 8px;">
                    <p><strong>Telefon:</strong> ${ordre.telefon || 'Ikke oppgitt'}</p>
                    <p><strong>Type:</strong> ${ordre.type === 'levering' ? '🚗 Utkjøring' : '🛍️ Henting'}</p>
                    ${ordre.adresse ? `<p><strong>Adresse:</strong> ${ordre.adresse}</p>` : ''}
                    <p><strong>Bestilte varer:</strong> ${retterTekst}</p>
                    <small style="color: #888;">Full ID: ${fullId}</small>
                </div>
            `;

            historikkListeContainer.appendChild(kort);
        });

    } catch (error) {
        console.error("Feil ved henting av historikk:", error);
        historikkListeContainer.innerHTML = "<p>Kunne ikke laste historikk (Sjekk at Firestore indeksen er opprettet dersom du ser feilmelding i konsollen).</p>";
    }
}

// Event Listeners for kategoriknapper
kategoriKnapper.forEach(knapp => {
    knapp.addEventListener("click", () => {
        aktivKategori = knapp.dataset.kategori;
        valgtKategoriTittel.textContent = knapp.textContent;
        visSkjemaBtn.style.display = "inline-block";
        
        nullstillOgSkjulSkjema();
        hentMenyForKategori(aktivKategori);
    });
});

// Vis skjema for ny rett
visSkjemaBtn.addEventListener("click", () => {
    nullstillOgSkjulSkjema();
    skjemaTittel.textContent = `Legg til ny rett i ${valgtKategoriTittel.textContent}`;
    skjemaContainer.style.display = "block";
});

// Avbryt skjema
avbrytBtn.addEventListener("click", nullstillOgSkjulSkjema);

// Lagre rett
rettForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    let bildeUrl = eksisterendeBildeUrl;

    if (rettBildeFilInput && rettBildeFilInput.files[0]) {
        try {
            bildeUrl = await komprimerBilde(rettBildeFilInput.files[0]);
        } catch (error) {
            console.error("Feil ved behandling av bilde:", error);
        }
    }

    const rettData = {
        kategori: aktivKategori,
        nummer: rettNummerInput.value ? parseInt(rettNummerInput.value) : null,
        navn: rettNavnInput.value.trim(),
        pris: parseFloat(rettPrisInput.value),
        sortering: parseInt(rettSorteringInput.value) || 1,
        beskrivelse: rettBeskrivelseInput.value.trim(),
        bildeUrl: bildeUrl || null
    };

    const id = rettIdInput.value;

    if (id) {
        await updateDoc(doc(db, "meny", id), rettData);
    } else {
        await addDoc(collection(db, "meny"), rettData);
    }

    nullstillOgSkjulSkjema();
    hentMenyForKategori(aktivKategori);
    fyllKobletRettDropdown();
});

// Hent menyretter
async function hentMenyForKategori(kategori) {
    rettListeContainer.innerHTML = "<p>Laster retter...</p>";

    try {
        const q = query(
            collection(db, "meny"), 
            where("kategori", "==", kategori),
            orderBy("sortering", "asc")
        );

        const snapshot = await getDocs(q);
        rettListeContainer.innerHTML = "";

        if (snapshot.empty) {
            rettListeContainer.innerHTML = "<p>Ingen retter i denne kategorien ennå.</p>";
            return;
        }

        snapshot.forEach(docSnap => {
            const rett = docSnap.data();
            const rettId = docSnap.id;
            
            const element = document.createElement("div");
            element.className = "admin-rett-kort";
            element.innerHTML = `
                <div>
                    <strong>${rett.nummer ? 'Nr. ' + rett.nummer + ' - ' : ''}${rett.navn}</strong> (${rett.pris} kr)
                    <p>${rett.beskrivelse || ''}</p>
                    <small>Rekkefølge: ${rett.sortering}</small>
                </div>
                <div class="handling-knapper">
                    <button class="rediger-btn">Rediger</button>
                    <button class="slett-btn">Slett</button>
                </div>
            `;

            const redigerBtn = element.querySelector(".rediger-btn");
            const slettBtn = element.querySelector(".slett-btn");

            redigerBtn.addEventListener("click", () => fyllSkjemaForRedigering(rettId, rett));
            
            let slettSikker = false;
            slettBtn.addEventListener("click", async () => {
                if (!slettSikker) {
                    slettSikker = true;
                    slettBtn.textContent = "Sikker?";
                    slettBtn.classList.add("slett-bekreft");
                } else {
                    await deleteDoc(doc(db, "meny", rettId));
                    hentMenyForKategori(aktivKategori);
                    fyllKobletRettDropdown();
                }
            });

            rettListeContainer.appendChild(element);
        });

    } catch (error) {
        console.error("Feil ved henting av meny:", error);
        rettListeContainer.innerHTML = "<p>Kunne ikke laste menyen.</p>";
    }
}

function fyllSkjemaForRedigering(id, rett) {
    rettIdInput.value = id;
    rettNummerInput.value = rett.nummer || "";
    rettNavnInput.value = rett.navn;
    rettPrisInput.value = rett.pris;
    rettSorteringInput.value = rett.sortering;
    rettBeskrivelseInput.value = rett.beskrivelse || "";
    
    eksisterendeBildeUrl = rett.bildeUrl || "";
    if (rettBildeFilInput) rettBildeFilInput.value = "";

    skjemaTittel.textContent = "Rediger rett";
    skjemaContainer.style.display = "block";
}

function nullstillOgSkjulSkjema() {
    rettForm.reset();
    rettIdInput.value = "";
    eksisterendeBildeUrl = "";
    skjemaContainer.style.display = "none";
}

// Banner-skjema
visNyttBannerBtn.addEventListener("click", () => {
    bannerForm.reset();
    bannerIdInput.value = "";
    bannerSkjemaContainer.style.display = "block";
});

avbrytBannerBtn.addEventListener("click", () => {
    bannerSkjemaContainer.style.display = "none";
});

// Lagre banner
bannerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const bannerData = {
        tittel: bannerTittelInput.value.trim(),
        tekst: bannerTekstInput.value.trim(),
        bildeUrl: bannerBildeUrlInput.value.trim(),
        kobletRettId: bannerKobletRettSelect.value || null,
        aktiv: bannerAktivCheckbox.checked
    };

    const id = bannerIdInput.value;

    if (id) {
        await updateDoc(doc(db, "banners", id), bannerData);
    } else {
        await addDoc(collection(db, "banners"), bannerData);
    }

    bannerForm.reset();
    bannerSkjemaContainer.style.display = "none";
    hentAlleBannere();
});

// Hent bannere
async function hentAlleBannere() {
    bannerListeContainer.innerHTML = "<p>Laster lysbilder...</p>";

    try {
        const snapshot = await getDocs(collection(db, "banners"));
        bannerListeContainer.innerHTML = "";

        if (snapshot.empty) {
            bannerListeContainer.innerHTML = "<p>Ingen lysbilder opprettet ennå.</p>";
            return;
        }

        snapshot.forEach(docSnap => {
            const banner = docSnap.data();
            const bannerId = docSnap.id;

            const element = document.createElement("div");
            element.className = "admin-banner-kort";
            element.innerHTML = `
                <div style="display: flex; gap: 10px; align-items: center;">
                    <img src="${banner.bildeUrl}" alt="${banner.tittel}" style="width: 60px; height: 60px; object-fit: cover;">
                    <div>
                        <strong>${banner.tittel}</strong> (${banner.aktiv ? 'Aktiv' : 'Skjult'})
                        <p>${banner.tekst || ''}</p>
                    </div>
                </div>
                <div>
                    <button class="slett-banner-btn">Slett</button>
                </div>
            `;

            const slettBtn = element.querySelector(".slett-banner-btn");
            let slettSikker = false;
            slettBtn.addEventListener("click", async () => {
                if (!slettSikker) {
                    slettSikker = true;
                    slettBtn.textContent = "Sikker?";
                    slettBtn.classList.add("slett-bekreft");
                } else {
                    await deleteDoc(doc(db, "banners", bannerId));
                    hentAlleBannere();
                }
            });

            bannerListeContainer.appendChild(element);
        });
    } catch (error) {
        console.error("Feil ved henting av bannere:", error);
    }
}

// Fyll dropdown med retter
async function fyllKobletRettDropdown() {
    try {
        const snapshot = await getDocs(collection(db, "meny"));
        bannerKobletRettSelect.innerHTML = '<option value="">-- Ingen kobling (kun visning) --</option>';

        snapshot.forEach(docSnap => {
            const rett = docSnap.data();
            const option = document.createElement("option");
            option.value = docSnap.id;
            option.textContent = `${rett.nummer ? 'Nr. ' + rett.nummer + ' ' : ''}${rett.navn} (${rett.pris} kr)`;
            bannerKobletRettSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Feil ved henting av meny for dropdown:", error);
    }
}