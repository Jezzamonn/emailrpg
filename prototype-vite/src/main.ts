import "./style.css";
import { Game } from "@game/game.ts";
import { handleIncomingEmail, type EmailResponse } from "@game/email/email.ts";

const game = new Game();

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
  lastGifUrl?: string;
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
    session = { email: normEmail };
    sessions.set(normEmail, session);
  }

  // Generate email response via shared handler
  const initialResp = handleIncomingEmail(game, {
    from: normEmail,
    body: bodyText,
  });

  let finalResp: EmailResponse;
  if (initialResp.gifBytes) {
    if (session.lastGifUrl) {
      URL.revokeObjectURL(session.lastGifUrl);
    }
    const blob = new Blob([initialResp.gifBytes.buffer as ArrayBuffer], { type: "image/gif" });
    session.lastGifUrl = URL.createObjectURL(blob);

    finalResp = handleIncomingEmail(game, {
      from: normEmail,
      body: bodyText,
      imageSrc: session.lastGifUrl,
    });
  } else {
    finalResp = initialResp;
  }

  session.lastResponse = finalResp;
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
  textBodyPre.textContent = resp.text;

  // Configure composer based on user's onboarding phase
  if (resp.phase === "welcome") {
    replyInput.placeholder = "Choose player look (e.g. 'King', 'Queen')...";
    replySubmitBtn.textContent = "Send Customization";
  } else {
    replyInput.placeholder = "Enter command (e.g. u, d 2, left 3, wait, dungeon, hub)...";
    replySubmitBtn.textContent = "Send Command";
  }

  setView(currentView);
}

// "Start game with email:" handler
startEmailForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = startEmailInput.value.trim();
  if (!email) return;

  const user = game.getUser(email);
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
