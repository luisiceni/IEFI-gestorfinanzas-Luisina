import Transaccion from "./classes/Transaccion.js";

const form = document.getElementById("form-transaccion");
const listaTransacciones = document.getElementById("lista-transacciones");
const elIngresos = document.getElementById("ingresos-totales");
const elGastos = document.getElementById("gastos-totales");
const elBalance = document.getElementById("balance-neto");
const canvasCategorias = document.getElementById("grafico-categorias");
const canvasEvolucion = document.getElementById("grafico-evolucion");

let graficoCategorias = null;
let graficoEvolucion = null;

function formatearMoneda(valor) {
    return valor.toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS"
    });
}

function formatearFecha(fechaISO) {
    const [anio, mes, dia] = fechaISO.split("-");
    return `${dia}/${mes}/${anio}`;
}

function calcularTotales() {

    let ingresos = 0;
    let gastos = 0;

    for (let i = 0; i < Transaccion.historial.length; i++) {
        const t = Transaccion.historial[i];

        if (t.tipo === "ingreso") {
            ingresos += t.monto;
        } else {
            gastos += t.monto;
        }
    }

    return { ingresos, gastos, balance: ingresos - gastos };
}


// Calcula el total por categoría
function agruparPorCategoria() {
    const grupos = {};

    Transaccion.historial.forEach((t) => {

        const signo = t.tipo === "ingreso" ? 1 : -1;

        grupos[t.categoria] = (grupos[t.categoria] || 0) + signo * t.monto;
    });

    return grupos;
}


function actualizarPanelBalance() {
    const { ingresos, gastos, balance } = calcularTotales();

    elIngresos.textContent = formatearMoneda(ingresos);
    elGastos.textContent = formatearMoneda(gastos);
    elBalance.textContent = formatearMoneda(balance);

    elBalance.classList.toggle("text-red-600", balance < 0);

    elBalance.classList.toggle("text-emerald-600", balance >= 0);
}


function alternarVacio(idContenedor, idMensaje, hayDatos) {
    document.getElementById(idContenedor).hidden = !hayDatos;
    document.getElementById(idMensaje).hidden = hayDatos;
}

function actualizarGraficoCategorias() {
    const grupos = agruparPorCategoria();
    const categorias = Object.keys(grupos);
    const valores = categorias.map((c) => grupos[c]);

    alternarVacio("contenedor-categorias", "categorias-vacio", categorias.length > 0);

    if (graficoCategorias) {
        graficoCategorias.destroy();
        graficoCategorias = null;
    }
    if (categorias.length === 0) return;

    graficoCategorias = new Chart(canvasCategorias, {
        type: "bar",
        data: {
            labels: categorias,
            datasets: [{
                label: "Total por categoría",
                data: valores,
                backgroundColor: valores.map((v) => (v < 0 ? "#b91c1c" : "#065f46")),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => formatearMoneda(ctx.parsed.y) } }
            },
            scales: {
                y: { ticks: { callback: (v) => formatearMoneda(v) } }
            }
        }
    });
}

function calcularEvolucion() {

    const porFecha = {};
    Transaccion.historial.forEach((t) => {
        if (!t.fecha) return; //BORRAR??
        if (!porFecha[t.fecha]) porFecha[t.fecha] = { ingresos: 0, egresos: 0 };
        if (t.tipo === "ingreso") porFecha[t.fecha].ingresos += t.monto;
        else porFecha[t.fecha].egresos += t.monto;
    });

    const fechas = Object.keys(porFecha).sort();

    let acumulado = 0;
    const ingresos = [];
    const egresos = [];
    const balance = [];
    fechas.forEach((f) => {
        ingresos.push(porFecha[f].ingresos);
        egresos.push(porFecha[f].egresos);
        acumulado += porFecha[f].ingresos - porFecha[f].egresos;
        balance.push(acumulado);
    });

    return { fechas, ingresos, egresos, balance };
}

function actualizarGraficoEvolucion() {
    const { fechas, ingresos, egresos, balance } = calcularEvolucion();

    alternarVacio("contenedor-evolucion", "evolucion-vacio", fechas.length > 0);

    if (graficoEvolucion) {
        graficoEvolucion.destroy();
        graficoEvolucion = null;
    }
    if (fechas.length === 0) return;

    graficoEvolucion = new Chart(canvasEvolucion, {
        type: "line",
        data: {
            labels: fechas.map(formatearFecha),
            datasets: [
                { label: "Ingresos", data: ingresos, borderColor: "#065f46", backgroundColor: "#065f46", tension: 0.25 },
                { label: "Egresos", data: egresos, borderColor: "#b91c1c", backgroundColor: "#b91c1c", tension: 0.25 },
                { label: "Balance Neto", data: balance, borderColor: "#1d4ed8", backgroundColor: "#1d4ed8", tension: 0.25 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatearMoneda(ctx.parsed.y)}` } }
            },
            scales: {
                y: { ticks: { callback: (v) => formatearMoneda(v) } }
            }
        }
    });
}

function actualizarFilaVacia() {
    const filaVacia = document.getElementById("fila-vacia");

    const hayFilas = Transaccion.historial.length > 0;

    if (hayFilas && filaVacia) {
        filaVacia.remove();

    } else if (!hayFilas && !filaVacia) {

        const tr = document.createElement("tr");
        tr.id = "fila-vacia";

        const td = document.createElement("td");
        td.colSpan = 6;
        td.className = "py-8 px-4 text-center text-slate-500";
        td.textContent = "No hay movimientos registrados.";

        tr.appendChild(td);
        listaTransacciones.appendChild(tr);
    }

}

function actualizarResumenes() {
    actualizarPanelBalance();
    actualizarGraficoCategorias();
    actualizarGraficoEvolucion();
    actualizarFilaVacia();
}

function crearCelda(clases) {
    const td = document.createElement("td");
    td.className = clases;
    return td;
}


function agregarFilaAlHistorial(transaccion) {
    const esIngreso = transaccion.tipo === "ingreso";

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition";
    tr.dataset.id = transaccion.id;

    const tdFecha = crearCelda("py-3.5 px-4 text-slate-600");
    tdFecha.textContent = transaccion.fecha ? formatearFecha(transaccion.fecha) : "-";

    const tdDescripcion = crearCelda("py-3.5 px-4 font-medium text-slate-800");
    tdDescripcion.textContent = transaccion.descripcion;

    const tdCategoria = crearCelda("py-3.5 px-4");
    const badgeCategoria = document.createElement("span");
    badgeCategoria.className =
        "bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full border border-slate-200";
    badgeCategoria.textContent = transaccion.categoria;
    tdCategoria.appendChild(badgeCategoria);

    const tdTipo = crearCelda("py-3.5 px-4");
    const badgeTipo = document.createElement("span");
    badgeTipo.className =
        "text-xs px-2 py-0.5 rounded font-semibold " +
        (esIngreso ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-600");
    badgeTipo.textContent = esIngreso ? "Ingreso" : "Gasto";
    tdTipo.appendChild(badgeTipo);

    const tdMonto = crearCelda(
        "py-3.5 px-4 text-right font-semibold " +
        (esIngreso ? "text-emerald-800" : "text-red-600")
    );
    tdMonto.textContent = (esIngreso ? "+" : "-") + formatearMoneda(transaccion.monto);

    const tdAcciones = crearCelda("py-3.5 px-4 text-center");
    const btnEliminar = document.createElement("button");
    btnEliminar.type = "button";
    btnEliminar.className = "text-red-500 hover:text-red-700 transition px-2 py-1";
    btnEliminar.title = "Eliminar";
    btnEliminar.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    btnEliminar.addEventListener("click", () => eliminarTransaccion(transaccion.id));
    tdAcciones.appendChild(btnEliminar);

    tr.append(tdFecha, tdDescripcion, tdCategoria, tdTipo, tdMonto, tdAcciones);
    listaTransacciones.prepend(tr);
}

function renderizarHistorialCompleto() {
    listaTransacciones.replaceChildren();
    Transaccion.historial.forEach((t) => {
        agregarFilaAlHistorial(t);
    });
}

function eliminarTransaccion(id) {
    Transaccion.eliminar(id);

    const fila = listaTransacciones.querySelector(`tr[data-id="${id}"]`);
    if (fila) fila.remove();

    actualizarResumenes();
}

form.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const datos = new FormData(form);
    const descripcion = datos.get("descripcion").trim();
    const monto = parseFloat(datos.get("monto"));
    const tipo = datos.get("tipo");
    const categoria = datos.get("categoria");
    const fecha = datos.get("fecha");
    if (!descripcion || !(monto > 0) || !tipo || !categoria || !fecha) return;

    const id = Date.now();

    const nueva = Transaccion.crear({ id, tipo, descripcion, monto, categoria, fecha });

    agregarFilaAlHistorial(nueva);
    actualizarResumenes();

    form.reset();
    document.getElementById("descripcion").focus();
});

renderizarHistorialCompleto();
actualizarResumenes();