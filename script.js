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
const nascimentoInput = document.getElementById("nascimentoInput");
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
  return String(valor ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function identificarEtapa(sala) {
  const normalizada = normalizarSala(sala);
  const match = normalizada.match(/^(\d+)(EF|EM)(?:-?[A-Z])?$/i);
  if (!match) return "";

  const ano = Number(match[1]);
  const etapa = match[2].toUpperCase();

  if (etapa === "EF" && ano >= 1 && ano <= 5) return "fundamental1";
  if (etapa === "EF" && ano >= 6 && ano <= 9) return "fundamental2";
  if (etapa === "EM" && ano >= 1 && ano <= 3) return "medio";
  return "";
}

function dataParaISO(valor) {
  if (!valor) return "";

  if (typeof valor === "object" && typeof valor.toDate === "function") {
    const data = valor.toDate();
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  const texto = String(valor).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const dia = br[1].padStart(2, "0");
    const mes = br[2].padStart(2, "0");
    return `${br[3]}-${mes}-${dia}`;
  }

  return "";
}

function formatarDataBR(valor) {
  const iso = dataParaISO(valor);
  if (!iso) return String(valor ?? "").trim() || "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function definirStatus(texto = "", tipo = "") {
  statusBox.textContent = texto;
  statusBox.className = `status mt-3${tipo ? ` ${tipo}` : ""}`;
}

function mapearAluno(item) {
  const nascimentoOriginal =
    item.dataNascimentoBR ||
    item.dataNascimento ||
    item["Data Nasc."] ||
    item["Data Nasc"] ||
    item.Nascimento ||
    "";

  return {
    rm: String(item.rm || item.RM || "").trim(),
    nome: String(item.nome || item["Nome do Aluno"] || item.Nome || "").trim(),
    nascimentoOriginal,
    nascimentoISO: dataParaISO(nascimentoOriginal),
    nascimentoBR: formatarDataBR(nascimentoOriginal),
    sala: normalizarSala(item.sala || item.Sala || ""),
    senha: String(item.senha || item.Senha || "").trim(),
    cpf: somenteDigitos(item.cpf || item.CPF || ""),
    email: String(item.email || item["E-mail"] || item.Email || "").trim()
  };
}

async function executarConsulta(campo, valor) {
  const consulta = query(
    collection(db, COLLECTION_NAME),
    where(campo, "==", valor),
    limit(1)
  );

  const snapshot = await getDocs(consulta);
  if (snapshot.empty) return null;
  return mapearAluno(snapshot.docs[0].data());
}

async function buscarAlunoPorCpf(cpf) {
  const cpfFormatado = formatarCpf(cpf);
  const tentativas = [
    ["cpf", cpf],
    ["cpf", cpfFormatado],
    ["CPF", cpf],
    ["CPF", cpfFormatado]
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
  const texto = btnSenha.querySelector("span");
  const icone = btnSenha.querySelector("i");
  if (texto) texto.textContent = "Mostrar";
  if (icone) icone.className = "bi bi-eye me-1";
}

function preencherResultado(aluno) {
  senhaAtual = aluno.senha;
  outputs.rm.textContent = aluno.rm || "—";
  outputs.nome.textContent = aluno.nome || "—";
  outputs.nascimento.textContent = aluno.nascimentoBR || "—";
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

function atualizarEstadoConsulta() {
  const cpf = somenteDigitos(cpfInput.value);
  const dataPreenchida = Boolean(nascimentoInput.value);
  btnConsultar.disabled = !etapaSelecionada || cpf.length !== 11 || !dataPreenchida;
}

async function consultar() {
  limparResultado();

  if (!etapaSelecionada) {
    definirStatus("Selecione a etapa de ensino antes de consultar.", "error");
    return;
  }

  const cpf = somenteDigitos(cpfInput.value);
  const nascimentoInformado = nascimentoInput.value;

  if (!cpfValido(cpf)) {
    definirStatus("Digite um CPF válido com 11 números.", "error");
    return;
  }

  if (!nascimentoInformado) {
    definirStatus("Informe a data de nascimento do aluno.", "error");
    return;
  }

  btnConsultar.disabled = true;
  cpfInput.disabled = true;
  nascimentoInput.disabled = true;
  definirStatus("Consultando credencial...");

  try {
    const aluno = await buscarAlunoPorCpf(cpf);

    if (!aluno) {
      definirStatus("Dados não localizados. Confira as informações digitadas.", "error");
      return;
    }

    if (identificarEtapa(aluno.sala) !== etapaSelecionada) {
      definirStatus("Dados não localizados para a etapa selecionada.", "error");
      return;
    }

    if (!aluno.nascimentoISO || aluno.nascimentoISO !== nascimentoInformado) {
      definirStatus("CPF ou data de nascimento não conferem.", "error");
      return;
    }

    preencherResultado(aluno);
    definirStatus("");
  } catch (erro) {
    const codigo = erro?.code || "";
    console.error("Erro ao consultar credencial:", erro);

    if (codigo.includes("permission-denied")) {
      definirStatus(
        "A consulta está bloqueada pelas regras do banco de dados. É necessário liberar um acesso seguro para este portal.",
        "error"
      );
    } else {
      definirStatus("Não foi possível consultar agora. Tente novamente em instantes.", "error");
    }
  } finally {
    cpfInput.disabled = false;
    nascimentoInput.disabled = false;
    atualizarEstadoConsulta();
  }
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
    nascimentoInput.disabled = false;
    cpfHelp.textContent = "Digite os 11 números do CPF. A busca é feita por correspondência exata.";
    definirStatus("");
    limparResultado();
    atualizarEstadoConsulta();
    cpfInput.focus();
  });
});

cpfInput.addEventListener("input", () => {
  cpfInput.value = formatarCpf(cpfInput.value);
  definirStatus("");
  limparResultado();
  atualizarEstadoConsulta();
});

nascimentoInput.addEventListener("input", () => {
  definirStatus("");
  limparResultado();
  atualizarEstadoConsulta();
});

cpfInput.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter" && !btnConsultar.disabled) consultar();
});

nascimentoInput.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter" && !btnConsultar.disabled) consultar();
});

btnConsultar.addEventListener("click", consultar);

btnSenha.addEventListener("click", () => {
  if (!senhaAtual) return;

  senhaVisivel = !senhaVisivel;
  outputs.senha.textContent = senhaVisivel ? senhaAtual : "••••••••";

  const texto = btnSenha.querySelector("span");
  const icone = btnSenha.querySelector("i");

  if (texto) texto.textContent = senhaVisivel ? "Ocultar" : "Mostrar";
  if (icone) icone.className = senhaVisivel ? "bi bi-eye-slash me-1" : "bi bi-eye me-1";
});

btnNovaConsulta.addEventListener("click", () => {
  etapaSelecionada = "";
  stageButtons.forEach((item) => {
    item.classList.remove("is-selected");
    item.setAttribute("aria-pressed", "false");
  });

  cpfInput.value = "";
  nascimentoInput.value = "";
  cpfInput.disabled = true;
  nascimentoInput.disabled = true;
  cpfHelp.textContent = "Selecione primeiro a etapa de ensino.";
  definirStatus("");
  limparResultado();
  atualizarEstadoConsulta();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

atualizarEstadoConsulta();
