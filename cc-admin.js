const openButton = document.getElementById("open");
const loginForm = document.getElementById("login");
const logoutButton = document.getElementById("logout");
const message = document.getElementById("message");
const editor = document.getElementById("editor");
const streamForm = document.getElementById("streamform");
const records = document.getElementById("records");
const resetButton = document.getElementById("reset");

let aktiverStream = null;

function nachricht(text, typ = "") {
  message.textContent = text;
  message.className = "notice " + typ;
}

function formularLeeren() {
  aktiverStream = null;

  document.getElementById("title").value = "";
  document.getElementById("streamer").value = "";
  document.getElementById("url").value = "";
  document.getElementById("starts").value = "";
  document.getElementById("description").value = "";
}

async function angemeldetPruefen() {
  const { data } = await db.auth.getUser();

  if (data && data.user) {
    editor.hidden = false;
    logoutButton.hidden = false;
    openButton.hidden = true;
    loginForm.hidden = true;

    formularLeeren();
    await streamsLaden();
  } else {
    editor.hidden = true;
    logoutButton.hidden = true;
    openButton.hidden = false;
    loginForm.hidden = true;
  }
}

async function streamsLaden() {
  const { data, error } = await db
    .from("community_streams")
    .select("*")
    .order("starts_at", { ascending: true });

  records.innerHTML = "";

  if (error) {
    records.innerHTML =
      `<div class="card"><div class="body"><h3>Fehler</h3><p>${error.message}</p></div></div>`;
    return;
  }

  if (!data || data.length === 0) {
    records.innerHTML =
      `<div class="card"><div class="body"><h3>Noch keine Streams</h3><p>Erstelle deinen ersten Stream oben.</p></div></div>`;
    return;
  }

  for (const stream of data) {
    const zeit = new Date(stream.starts_at);
    const karte = document.createElement("article");
    karte.className = "card";

    karte.innerHTML = `
      <div class="media label" style="background-image:linear-gradient(135deg,#f7971e,#ffd200)">Stream</div>
      <div class="body">
        <span class="badge">Geplant</span>
        <h3>${stream.title}</h3>
        <p><strong>Streamer:</strong> ${stream.streamer}</p>
        <p><strong>Termin:</strong> ${zeit.toLocaleString("de-DE")}</p>
        <p>${stream.description || ""}</p>
        <a class="btn" href="${stream.url}" target="_blank" rel="noopener noreferrer">Stream öffnen</a>
      </div>
    `;

    const bearbeiten = document.createElement("button");
    bearbeiten.className = "btn ghost";
    bearbeiten.textContent = "Bearbeiten";

    bearbeiten.addEventListener("click", () => {
      aktiverStream = stream;

      document.getElementById("title").value = stream.title;
      document.getElementById("streamer").value = stream.streamer;
      document.getElementById("url").value = stream.url;
      document.getElementById("starts").value = new Date(stream.starts_at)
        .toISOString()
        .slice(0, 16);
      document.getElementById("description").value = stream.description || "";

      nachricht("Stream wird bearbeitet.");
      editor.scrollIntoView({ behavior: "smooth" });
    });

    const loeschen = document.createElement("button");
    loeschen.className = "btn ghost";
    loeschen.textContent = "Löschen";

    loeschen.addEventListener("click", async () => {
      if (!confirm("Diesen Stream wirklich löschen?")) {
        return;
      }

      const { error: loeschFehler } = await db
        .from("community_streams")
        .delete()
        .eq("id", stream.id);

      if (loeschFehler) {
        nachricht("Löschen fehlgeschlagen: " + loeschFehler.message, "error");
        return;
      }

      nachricht("Stream wurde gelöscht.", "ok");
      await streamsLaden();
    });

    karte.querySelector(".body").appendChild(bearbeiten);
    karte.querySelector(".body").appendChild(loeschen);
    records.appendChild(karte);
  }
}

openButton.addEventListener("click", () => {
  loginForm.hidden = false;
  openButton.hidden = true;
});

loginForm.addEventListener("submit", async (ereignis) => {
  ereignis.preventDefault();

  const email = document.getElementById("email").value.trim();
  const passwort = document.getElementById("password").value;

  nachricht("Anmeldung wird geprüft …");

  const { error } = await db.auth.signInWithPassword({
    email,
    password: passwort
  });

  if (error) {
    nachricht("Anmeldung fehlgeschlagen: " + error.message, "error");
    return;
  }

  nachricht("Anmeldung erfolgreich.", "ok");
  await angemeldetPruefen();
});

logoutButton.addEventListener("click", async () => {
  await db.auth.signOut();
  nachricht("Du bist abgemeldet.");
  await angemeldetPruefen();
});

resetButton.addEventListener("click", () => {
  formularLeeren();
  nachricht("Neuer Stream kann eingetragen werden.");
});

streamForm.addEventListener("submit", async (ereignis) => {
  ereignis.preventDefault();

  const titel = document.getElementById("title").value.trim();
  const streamer = document.getElementById("streamer").value.trim();
  const link = document.getElementById("url").value.trim();
  const zeit = document.getElementById("starts").value;
  const beschreibung = document.getElementById("description").value.trim();

  if (!titel || !streamer || !link || !zeit) {
    nachricht("Bitte Titel, Streamer, Link und Datum/Uhrzeit ausfüllen.", "error");
    return;
  }

  const eintrag = {
    title: titel,
    streamer,
    url: link,
    starts_at: new Date(zeit).toISOString(),
    description: beschreibung
  };

  nachricht("Stream wird gespeichert …");

  let fehler = null;

  if (aktiverStream) {
    const ergebnis = await db
      .from("community_streams")
      .update(eintrag)
      .eq("id", aktiverStream.id);

    fehler = ergebnis.error;
  } else {
    const ergebnis = await db
      .from("community_streams")
      .insert(eintrag);

    fehler = ergebnis.error;
  }

  if (fehler) {
    nachricht("Speichern fehlgeschlagen: " + fehler.message, "error");
    return;
  }

  nachricht(
    aktiverStream ? "Änderungen wurden gespeichert." : "Stream wurde gespeichert.",
    "ok"
  );

  if (!aktiverStream) {
    try {
      await fetch("/.netlify/functions/discord-notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(eintrag)
      });
    } catch (discordFehler) {
      console.error("Discord-Benachrichtigung fehlgeschlagen:", discordFehler);
    }
  }

  formularLeeren();
  await streamsLaden();
});

angemeldetPruefen();