import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC7eOlbrbPBpMe98s-2VcJCYABWuJlOIG0",
  authDomain: "ce1132026-alunos.firebaseapp.com",
  projectId: "ce1132026-alunos",
  storageBucket: "ce1132026-alunos.firebasestorage.app",
  messagingSenderId: "1027156600865",
  appId: "1:1027156600865:web:baab92fdb2713756245b60"
};

const COLLECTION_NAME = "alunos_2026";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const stageButtons = [...document.querySelectorAll(".stage-card")];
const cpfInput = document.getElementById("cpfInput");
const cpfHelp = document.getElementById("cpfHelp");
const btnConsultar = document.getElementById("btnConsultar");
const btnNovaConsulta = document.getElementById("btnNovaConsulta");
const btnSenha = document.getElementById("btnSenha");
const statusBox = document.getElementById("status");
const resultSection = document.getElementById("resultSection");

const outputs = {
  rm: document.getElementById("outRm"),
  nome: document.getElementById("outNome"),
  nascimento: document.getElementById("outNascimento"),
  sala: document.getElementById("outSala"),
  salaBadge: document.getElementById("outSalaBadge"),
  senha: document.getElementById("outSenha"),
  cpf: document.getElementById("outCpf"),
  email: document.getElementById("outEmail")
};

let etapaSelecionada = "";
let senhaAtual = "";
let senhaVisivel = false;
let debounceCpf;

function somenteDigitos(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

function formatarCpf(valor) {
  const cpf = somenteDigitos(valor).slice(0, 11);
  if (cpf.length <= 3) return cpf;
  if (cpf.length <= 6) return `${cpf.slice(0, 3)}.${cpf.slice(3)}`;
  if (cpf.length <= 9) return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6)}`;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}`;
}

function cpfValido(cpf) {
  const n = somenteDigitos(cpf);
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;

  const calcularDigito = (base, pesoInicial) => {
    let soma = 0;
    for (let i = 0; i < base.length; i += 1) {
      soma += Number(base[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = calcularDigito(n.slice(0, 9), 10);
  const d2 = calcularDigito(n.slice(0, 10), 11);
  return d1 === Number(n[9]) && d2 === Number(n[10]);
}

function normalizarSala(valor) {
  return String(valor ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function identificarEtapa(sala) {
  const normalizada = normalizarSala(sala);
  const match = normalizada.match(/^(\d+)(EF|EM)(?:-|\s)?[A-Z]?$/i);
  if (!match) return "";

  const ano = Number(match[1]);
  const etapa = match[2].toUpperCase();

  if (etapa === "EF" && ano >= 1 && ano <= 5) return "fundamental1";
  if (etapa === "EF" && ano >= 6 && ano <= 9) return "fundamental2";
  if (etapa === "EM" && ano >= 1 && ano <= 3) return "medio";
  return "";
}

function formatarData(valor) {
  if (!valor) return "—";

  if (typeof valor === "object" && typeof valor.toDate === "function") {
    const data = valor.toDate();
    return new Intl.DateTimeFormat("pt-BR").format(data);
  }

  const texto = String(valor).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) return texto;

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [ano, mes, dia] = texto.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  return texto || "—";
}

function definirStatus(texto = "", tipo = "") {
  statusBox.textContent = texto;
  statusBox.className = `status${tipo ? ` ${tipo}` : ""}`;
}

function mapearAluno(item) {
  return {
    rm: String(item.rm || item.RM || "").trim(),
    nome: String(item.nome || item["Nome do Aluno"] || item["Nome"] || "").trim(),
    nascimento: formatarData(
      item.dataNascimentoBR ||
      item.dataNascimento ||
      item["Data Nasc."] ||
      item["Data Nasc"] ||
      item.Nascimento
    ),
    sala: normalizarSala(item.sala || item.Sala || ""),
    senha: String(item.senha || item.Senha || "").trim(),
    cpf: somenteDigitos(item.cpf || item.CPF || ""),
    email: String(item.email || item["E-mail"] || item.Email || "").trim()
  };
}

async function executarConsulta(field, value) {
  const q = query(
    collection(db, COLLECTION_NAME),
    where(field, "==", value),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return mapearAluno(snapshot.docs[0].data());
}

async function buscarAlunoPorCpf(cpf) {
  const formatos = [cpf, formatarCpf(cpf)];
  const tentativas = [
    ["cpf", formatos[0]],
    ["cpf", formatos[1]],
    ["CPF", formatos[0]],
    ["CPF", formatos[1]]
  ];

  for (const [campo, valor] of tentativas) {
    const aluno = await executarConsulta(campo, valor);
    if (aluno) return aluno;
  }

  return null;
}

function ocultarSenha() {
  senhaVisivel = false;
  outputs.senha.textContent = senhaAtual ? "••••••••" : "—";
  btnSenha.textContent = "Mostrar";
}

function preencherResultado(aluno) {
  senhaAtual = aluno.senha;
  outputs.rm.textContent = aluno.rm || "—";
  outputs.nome.textContent = aluno.nome || "—";
  outputs.nascimento.textContent = aluno.nascimento || "—";
  outputs.sala.textContent = aluno.sala || "—";
  outputs.salaBadge.textContent = aluno.sala || "—";
  outputs.cpf.textContent = aluno.cpf ? formatarCpf(aluno.cpf) : "—";
  outputs.email.textContent = aluno.email || "—";
  ocultarSenha();

  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function limparResultado() {
  resultSection.hidden = true;
  senhaAtual = "";
  senhaVisivel = false;
}

async function consultar() {
  limparResultado();

  if (!etapaSelecionada) {
    definirStatus("Selecione a etapa de ensino antes de consultar.", "error");
    return;
  }

  const cpf = somenteDigitos(cpfInput.value);

  if (!cpfValido(cpf)) {
    definirStatus("Digite um CPF válido com 11 números.", "error");
    return;
  }

  btnConsultar.disabled = true;
  cpfInput.disabled = true;
  definirStatus("Consultando credencial...");

  try {
    const aluno = await buscarAlunoPorCpf(cpf);

    if (!aluno || identificarEtapa(aluno.sala) !== etapaSelecionada) {
      definirStatus("CPF não localizado para a etapa selecionada.", "error");
      return;
    }

    preencherResultado(aluno);
    definirStatus("Credencial localizada com sucesso.", "success");
  } catch (erro) {
    const codigo = erro?.code || "";

    if (codigo.includes("permission-denied")) {
      definirStatus("A consulta está bloqueada pelas regras do banco de dados. É necessário liberar um acesso seguro para este portal.", "error");
    } else {
      definirStatus("Não foi possível consultar agora. Tente novamente em instantes.", "error");
    }
  } finally {
    cpfInput.disabled = false;
    btnConsultar.disabled = false;
    cpfInput.focus();
  }
}

function atualizarEstadoConsulta() {
  const cpf = somenteDigitos(cpfInput.value);
  btnConsultar.disabled = !etapaSelecionada || cpf.length !== 11;
}

stageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    etapaSelecionada = button.dataset.stage;

    stageButtons.forEach((item) => {
      const selecionado = item === button;
      item.classList.toggle("is-selected", selecionado);
      item.setAttribute("aria-pressed", String(selecionado));
    });

    cpfInput.disabled = false;
    cpfHelp.textContent = "Digite o CPF completo. A busca é feita somente por correspondência exata.";
    definirStatus("");
    limparResultado();
    atualizarEstadoConsulta();
    cpfInput.focus();
  });
});

cpfInput.addEventListener("input", () => {
  cpfInput.value = formatarCpf(cpfInput.value);
  limparResultado();
  definirStatus("");
  atualizarEstadoConsulta();

  clearTimeout(debounceCpf);
  const cpf = somenteDigitos(cpfInput.value);

  if (etapaSelecionada && cpf.length === 11 && cpfValido(cpf)) {
    debounceCpf = setTimeout(() => consultar(), 500);
  }
});

cpfInput.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter" && !btnConsultar.disabled) {
    consultar();
  }
});

btnConsultar.addEventListener("click", consultar);

btnNovaConsulta.addEventListener("click", () => {
  cpfInput.value = "";
  limparResultado();
  definirStatus("");
  atualizarEstadoConsulta();
  cpfInput.focus();
});

btnSenha.addEventListener("click", () => {
  if (!senhaAtual) return;

  senhaVisivel = !senhaVisivel;
  outputs.senha.textContent = senhaVisivel ? senhaAtual : "••••••••";
  btnSenha.textContent = senhaVisivel ? "Ocultar" : "Mostrar";
});
