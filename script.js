
const login = document.getElementById("login");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const masterInput = document.getElementById("masterPassword");
const loginMessage = document.getElementById("loginMessage");
const setupButton = document.getElementById("setupButton");
const sectionContent = document.getElementById("sectionContent");

const sections = {
    tasks: {
        title: "Mis tareas",
        description: "Organiza tus pendientes.",
        placeholder: "Escribe una tarea..."
    },
    planner: {
        title: "Mi día",
        description: "Planea tus actividades diarias.",
        placeholder: "¿Qué quieres hacer hoy?"
    },
    skincare: {
        title: "Skincare",
        description: "Registra tus productos y tu rutina de cuidado.",
        placeholder: "Producto, ingredientes o notas..."
    },
    wellbeing: {
        title: "Mi bienestar",
        description: "Haz una pausa y escribe cómo te sientes.",
        placeholder: "¿Cómo te sientes hoy?"
    },
    diary: {
        title: "Mi diario",
        description: "Un espacio para tus pensamientos personales.",
        placeholder: "Escribe lo que quieras guardar..."
    }
};

let currentSection = "";
let masterHash = localStorage.getItem("elle_master_hash");
let sectionHashes = JSON.parse(
    localStorage.getItem("elle_section_hashes") || "{}"
);

// Hash de contraseñas mediante Web Crypto.
async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const saltBytes = salt
        ? Uint8Array.from(atob(salt), c => c.charCodeAt(0))
        : crypto.getRandomValues(new Uint8Array(16));

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits({
        name: "PBKDF2",
        salt: saltBytes,
        iterations: 250000,
        hash: "SHA-256"
    }, key, 256);

    const hash = btoa(String.fromCharCode(
        ...new Uint8Array(bits)
    ));

    return {
        salt: btoa(String.fromCharCode(...saltBytes)),
        hash
    };
}

async function verifyPassword(password, saved) {
    const result = await hashPassword(password, saved.salt);
    return result.hash === saved.hash;
}

function showDashboard() {
    login.hidden = true;
    dashboard.hidden = false;
}

function showLogin() {
    dashboard.hidden = true;
    login.hidden = false;
    masterInput.value = "";
}

setupButton.addEventListener("click", async () => {
    if (masterHash) {
        loginMessage.textContent =
            "Ya existe una contraseña principal en este navegador.";
        return;
    }

    const password = prompt(
        "Crea una contraseña principal de al menos 8 caracteres:"
    );

    if (!password || password.length < 8) {
        loginMessage.textContent =
            "La contraseña debe tener al menos 8 caracteres.";
        return;
    }

    const saved = await hashPassword(password);
    masterHash = saved;
    localStorage.setItem("elle_master_hash", JSON.stringify(saved));

    loginMessage.textContent =
        "Contraseña creada. Ahora inicia sesión.";
});

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    masterHash = localStorage.getItem("elle_master_hash");

    if (!masterHash) {
        loginMessage.textContent =
            "Primero crea tu contraseña principal.";
        return;
    }

    try {
        const saved = JSON.parse(masterHash);
        const valid = await verifyPassword(masterInput.value, saved);

        if (!valid) {
            loginMessage.textContent = "Contraseña incorrecta.";
            return;
        }

        sessionStorage.setItem("elle_logged_in", "true");
        showDashboard();
        loginMessage.textContent = "";
    } catch {
        loginMessage.textContent = "No se pudo verificar la contraseña.";
    }
});

document.getElementById("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("elle_logged_in");
    sessionStorage.removeItem("elle_open_sections");
    showLogin();
});

document.querySelectorAll("[data-section]").forEach(button => {
    button.addEventListener("click", async () => {
        if (sessionStorage.getItem("elle_logged_in") !== "true") {
            showLogin();
            return;
        }

        const name = button.dataset.section;
        currentSection = name;

        document.querySelectorAll("[data-section]").forEach(item => {
            item.classList.toggle("active", item === button);
        });

        await openSection(name);
    });
});

function getOpenSections() {
    return JSON.parse(
        sessionStorage.getItem("elle_open_sections") || "[]"
    );
}

function setSectionOpen(name) {
    const openSections = getOpenSections();

    if (!openSections.includes(name)) {
        openSections.push(name);
    }

    sessionStorage.setItem(
        "elle_open_sections",
        JSON.stringify(openSections)
    );
}

async function openSection(name) {
    const section = sections[name];
    if (!section) return;

    sectionHashes = JSON.parse(
        localStorage.getItem("elle_section_hashes") || "{}"
    );

    if (!sectionHashes[name]) {
        const create = confirm(
            `Esta sección aún no tiene contraseña. ¿Quieres crear una para "${section.title}"?`
        );

        if (!create) return;

        const password = prompt(
            "Crea una contraseña de al menos 8 caracteres:"
        );

        if (!password || password.length < 8) {
            alert("La contraseña debe tener al menos 8 caracteres.");
            return;
        }

        sectionHashes[name] = await hashPassword(password);
        localStorage.setItem(
            "elle_section_hashes",
            JSON.stringify(sectionHashes)
        );
    }

    if (!getOpenSections().includes(name)) {
        const password = prompt(
            `Ingresa la contraseña de "${section.title}":`
        );

        if (!password) return;

        const valid = await verifyPassword(
            password,
            sectionHashes[name]
        );

        if (!valid) {
            alert("Contraseña incorrecta.");
            return;
        }

        setSectionOpen(name);
    }

    renderSection(name);
}

function renderSection(name) {
    const section = sections[name];
    const key = `elle_data_${name}`;
    const entries = JSON.parse(localStorage.getItem(key) || "[]");

    sectionContent.innerHTML = `
        <h2>${section.title}</h2>
        <p>${section.description}</p>
        <form id="entryForm">
            <label for="entryText">Nueva nota</label>
            <textarea id="entryText" maxlength="3000"
                placeholder="${section.placeholder.replace(/"/g, "&quot;")}"
                required></textarea>
            <button type="submit">Guardar</button>
            <button type="button" class="secondary" id="lockSection">
                Bloquear sección
            </button>
        </form>
        <div id="entries"></div>
    `;

    const entriesBox = document.getElementById("entries");

    function drawEntries() {
        const currentEntries = JSON.parse(
            localStorage.getItem(key) || "[]"
        );

        entriesBox.replaceChildren();

        currentEntries.forEach((entry, index) => {
            const card = document.createElement("article");
            card.className = "entry";

            const date = document.createElement("small");
            date.textContent = entry.date;

            const content = document.createElement("p");
            content.textContent = entry.text;

            const remove = document.createElement("button");
            remove.className = "secondary";
            remove.textContent = "Eliminar";

            remove.addEventListener("click", () => {
                if (!confirm("¿Quieres eliminar esta nota?")) return;

                const updated = JSON.parse(
                    localStorage.getItem(key) || "[]"
                );

                updated.splice(index, 1);
                localStorage.setItem(key, JSON.stringify(updated));
                drawEntries();
            });

            card.append(date, content, remove);
            entriesBox.append(card);
        });
    }

    document.getElementById("entryForm").addEventListener(
        "submit",
        event => {
            event.preventDefault();

            const text = document.getElementById("entryText")
                .value.trim();

            if (!text) return;

            const currentEntries = JSON.parse(
                localStorage.getItem(key) || "[]"
            );

            currentEntries.unshift({
                text,
                date: new Date().toLocaleString("es-EC")
            });

            localStorage.setItem(key, JSON.stringify(currentEntries));
            document.getElementById("entryText").value = "";
            drawEntries();
        }
    );

    document.getElementById("lockSection").addEventListener("click", () => {
        sessionStorage.setItem(
            "elle_open_sections",
            JSON.stringify(getOpenSections().filter(item => item !== name))
        );

        sectionContent.innerHTML = `
            <h2>Sección bloqueada</h2>
            <p>Vuelve a ingresar tu contraseña para abrirla.</p>
        `;
    });

    drawEntries();
}

// Mantener la sesión solo mientras dure la sesión de la pestaña.
if (sessionStorage.getItem("elle_logged_in") === "true") {
    showDashboard();
} else {
    showLogin();
}
