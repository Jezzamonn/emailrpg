import "./style.css";
import { createGame, type GameState } from "@game/game.ts";
import { handleIncomingEmail, type EmailResponse } from "@game/email/email.ts";

const GAME_STORAGE_KEY = "ld60_game_state";
const EMAILS_STORAGE_KEY = "ld60_last_emails";
const ACTIVE_EMAIL_STORAGE_KEY = "ld60_active_email";

interface SerializedEmailResponse {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  images: Record<string, string>;
}

interface UserSession {
  email: string;
  lastResponse?: EmailResponse;
  imageUrls: Record<string, string>;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function serializeEmailResponse(resp: EmailResponse): SerializedEmailResponse {
  const images: Record<string, string> = {};
  for (const [id, bytes] of Object.entries(resp.images)) {
    images[id] = bytesToBase64(bytes);
  }
  return {
    from: resp.from,
    to: resp.to,
    subject: resp.subject,
    text: resp.text,
    html: resp.html,
    images,
  };
}

function deserializeEmailResponse(serialized: SerializedEmailResponse): EmailResponse {
  const images: Record<string, Uint8Array> = {};
  for (const [id, b64] of Object.entries(serialized.images ?? {})) {
    images[id] = base64ToBytes(b64);
  }
  return {
    from: serialized.from,
    to: serialized.to,
    subject: serialized.subject,
    text: serialized.text,
    html: serialized.html,
    images,
  };
}

function createImageUrls(images: Record<string, Uint8Array>): Record<string, string> {
  const imageUrls: Record<string, string> = {};
  for (const [id, bytes] of Object.entries(images)) {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "image/gif" });
    imageUrls[id] = URL.createObjectURL(blob);
  }
  return imageUrls;
}

let game: GameState = createGame();
const sessions = new Map<string, UserSession>();
let activeEmail: string | null = null;
let currentView: "html" | "text" = "html";

function saveState() {
  try {
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(game));

    const lastEmails: Record<string, SerializedEmailResponse> = {};
    for (const [email, session] of sessions.entries()) {
      if (session.lastResponse) {
        lastEmails[email] = serializeEmailResponse(session.lastResponse);
      }
    }
    localStorage.setItem(EMAILS_STORAGE_KEY, JSON.stringify(lastEmails));

    if (activeEmail) {
      localStorage.setItem(ACTIVE_EMAIL_STORAGE_KEY, activeEmail);
    } else {
      localStorage.removeItem(ACTIVE_EMAIL_STORAGE_KEY);
    }
  } catch (err) {
    console.error("Failed to save state to localStorage:", err);
  }
}

function loadState() {
  try {
    const savedGame = localStorage.getItem(GAME_STORAGE_KEY);
    if (savedGame) {
      game = JSON.parse(savedGame) as GameState;
    }

    const savedEmails = localStorage.getItem(EMAILS_STORAGE_KEY);
    if (savedEmails) {
      const parsedEmails = JSON.parse(savedEmails) as Record<string, SerializedEmailResponse>;
      for (const [email, serializedResp] of Object.entries(parsedEmails)) {
        const lastResponse = deserializeEmailResponse(serializedResp);
        sessions.set(email, {
          email,
          lastResponse,
          imageUrls: createImageUrls(lastResponse.images),
        });
      }
    }

    for (const email of Object.keys(game.players)) {
      if (!sessions.has(email)) {
        sessions.set(email, { email, imageUrls: {} });
      }
    }

    const savedActiveEmail = localStorage.getItem(ACTIVE_EMAIL_STORAGE_KEY);
    if (savedActiveEmail && sessions.has(savedActiveEmail)) {
      activeEmail = savedActiveEmail;
    } else if (sessions.size > 0) {
      activeEmail = sessions.keys().next().value ?? null;
    }
  } catch (err) {
    console.error("Failed to load state from localStorage:", err);
  }
}

// DOM elements - Session Bar
const startEmailForm = document.querySelector<HTMLFormElement>("#start-email-form")!;
const startEmailInput = document.querySelector<HTMLInputElement>("#start-email-input")!;
const sessionSwitcher = document.querySelector<HTMLDivElement>("#session-switcher")!;
const sessionPills = document.querySelector<HTMLDivElement>("#session-pills")!;

// DOM elements - Email Client
const emailHeader = document.querySelector<HTMLDivElement>("#email-header")!;
const emailSubject = document.querySelector<HTMLHeadingElement>("#email-subject")!;
const emailFrom = document.querySelector<HTMLSpanElement>("#email-from")!;
const emailTo = document.querySelector<HTMLSpanElement>("#email-to")!;
const blankState = document.querySelector<HTMLDivElement>("#blank-state")!;
const htmlBodyContainer = document.querySelector<HTMLDivElement>("#html-body-container")!;
const textBodyContainer = document.querySelector<HTMLDivElement>("#text-body-container")!;
const textBodyPre = document.querySelector<HTMLPreElement>("#text-body-pre")!;
const emailFooter = document.querySelector<HTMLDivElement>("#email-footer")!;

const btnHtmlView = document.querySelector<HTMLButtonElement>("#btn-html-view")!;
const btnTextView = document.querySelector<HTMLButtonElement>("#btn-text-view")!;

const replyForm = document.querySelector<HTMLFormElement>("#reply-form")!;
const replyInput = document.querySelector<HTMLInputElement>("#reply-input")!;
const replySubmitBtn = document.querySelector<HTMLButtonElement>("#reply-submit-btn")!;

function setView(view: "html" | "text") {
  currentView = view;
  if (view === "html") {
    btnHtmlView.classList.add("active");
    btnTextView.classList.remove("active");
    htmlBodyContainer.style.display = "block";
    textBodyContainer.style.display = "none";
  } else {
    btnTextView.classList.add("active");
    btnHtmlView.classList.remove("active");
    htmlBodyContainer.style.display = "none";
    textBodyContainer.style.display = "block";
  }
}

btnHtmlView.addEventListener("click", () => setView("html"));
btnTextView.addEventListener("click", () => setView("text"));

function sendEmailForSession(email: string, bodyText: string) {
  const normEmail = email.toLowerCase().trim();
  let session = sessions.get(normEmail);
  if (!session) {
    session = { email: normEmail, imageUrls: {} };
    sessions.set(normEmail, session);
  }

  // Generate email response via shared handler
  const result = handleIncomingEmail(game, {
    from: normEmail,
    body: bodyText,
  });

  // Turn the attached images into blob URLs so "cid:" references can be resolved in the preview.
  for (const url of Object.values(session.imageUrls)) {
    URL.revokeObjectURL(url);
  }
  session.imageUrls = createImageUrls(result.response.images);

  game = result.game;
  session.lastResponse = result.response;
  activeEmail = normEmail;
  saveState();
  renderUI();
}

function renderUI() {
  // Update session pills
  const emailList = Array.from(sessions.keys());
  if (emailList.length > 0) {
    sessionSwitcher.style.display = "flex";
    sessionPills.innerHTML = "";
    for (const email of emailList) {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = `user-pill ${email === activeEmail ? "active" : ""}`;

      pill.textContent = email;

      pill.addEventListener("click", () => {
        activeEmail = email;
        saveState();
        renderUI();
      });
      sessionPills.appendChild(pill);
    }
  } else {
    sessionSwitcher.style.display = "none";
  }

  // If no active session or no response yet
  if (!activeEmail || !sessions.get(activeEmail)?.lastResponse) {
    blankState.style.display = "block";
    emailHeader.style.display = "none";
    htmlBodyContainer.style.display = "none";
    textBodyContainer.style.display = "none";
    emailFooter.style.display = "none";
    return;
  }

  const session = sessions.get(activeEmail)!;
  const resp = session.lastResponse!;

  blankState.style.display = "none";
  emailHeader.style.display = "block";
  emailFooter.style.display = "block";

  emailSubject.textContent = resp.subject;
  emailFrom.textContent = resp.from;
  emailTo.textContent = resp.to;

  htmlBodyContainer.innerHTML = resp.html;
  for (const img of htmlBodyContainer.querySelectorAll<HTMLImageElement>('img[src^="cid:"]')) {
    const url = session.imageUrls[img.getAttribute("src")!.slice("cid:".length)];
    if (url) img.src = url;
  }
  textBodyPre.textContent = resp.text;

  // Configure composer based on user's onboarding phase
  if (game.players[activeEmail]?.state === "awaiting_customization") {
    replyInput.placeholder = "Describe your look (e.g. 'ponytail, blonde hair, light skin, blue clothes')...";
    replySubmitBtn.textContent = "Send Customization";
  } else if (game.players[activeEmail]?.state === "dead") {
    replyInput.placeholder = "You died! Enter 'restart' or 'exit'...";
    replySubmitBtn.textContent = "Send Choice";
  } else {
    replyInput.placeholder = "Enter command (e.g. up, down 2, a1, m10, wait, restart, exit)...";
    replySubmitBtn.textContent = "Send Command";
  }

  setView(currentView);
}

// "Start game with email:" handler
startEmailForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = startEmailInput.value.trim();
  if (!email) return;

  const normEmail = email.toLowerCase().trim();
  const user = game.players[normEmail];
  if (!user) {
    // New user -> send initial email to trigger welcome response
    sendEmailForSession(normEmail, "");
  } else {
    // Existing user -> switch to their active session
    activeEmail = normEmail;
    saveState();
    renderUI();
  }
});

// Reply form handler (simulates sending from activeEmail)
replyForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!activeEmail) return;
  const command = replyInput.value.trim();
  if (command) {
    replyInput.value = "";
    sendEmailForSession(activeEmail, command);
  }
});

loadState();
renderUI();
