import "./style.css";
import { createGame } from "@game/game.ts";
import { handleIncomingEmail, type EmailResponse } from "@game/email/email.ts";

let game = createGame();

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

interface UserSession {
  email: string;
  lastResponse?: EmailResponse;
  imageUrls: Record<string, string>;
}

const sessions = new Map<string, UserSession>();
let activeEmail: string | null = null;
let currentView: "html" | "text" = "html";

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
  session.imageUrls = {};
  for (const [id, bytes] of Object.entries(result.response.images)) {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "image/gif" });
    session.imageUrls[id] = URL.createObjectURL(blob);
  }

  game = result.game;
  session.lastResponse = result.response;
  activeEmail = normEmail;
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
    replyInput.placeholder = "You died! Enter 'restart' or 'island'...";
    replySubmitBtn.textContent = "Send Choice";
  } else {
    replyInput.placeholder = "Enter command (e.g. up, down 2, a1, m10, wait)...";
    replySubmitBtn.textContent = "Send Command";
  }

  setView(currentView);
}

// "Start game with email:" handler
startEmailForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = startEmailInput.value.trim();
  if (!email) return;

  const user = game.players[email.toLowerCase().trim()];
  if (!user) {
    // New user -> send initial email to trigger welcome response
    sendEmailForSession(email, "");
  } else {
    // Existing user -> switch to their active session
    activeEmail = email.toLowerCase().trim();
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

renderUI();
