const sections = {
  overview: { label: "Overview" },
  customers: {
    label: "Customers",
    description: "Keep every customer relationship organized and accessible.",
    empty: "Customer records are stored only by the authenticated application. This public preview does not fetch or display them."
  },
  rfqs: { label: "RFQ & Sourcing" },
  suppliers: {
    label: "Suppliers",
    description: "Keep every supplier relationship organized and accessible.",
    empty: "Supplier records are stored only by the authenticated application. This public preview does not fetch or display them."
  }
};

const overview = document.querySelector("#overview");
const directory = document.querySelector("#directory");
const rfqs = document.querySelector("#rfqs");
const navItems = [...document.querySelectorAll("[data-view]")];

function showView(name) {
  const target = sections[name];
  if (!target) return;

  navItems.forEach((item) => {
    const active = item.dataset.view === name;
    item.classList.toggle("selected", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
    const indicator = item.querySelector(".active-indicator");
    if (indicator) indicator.remove();
    if (active) {
      const dot = document.createElement("span");
      dot.className = "active-indicator";
      item.append(dot);
    }
  });

  overview.hidden = name !== "overview";
  directory.hidden = name !== "customers" && name !== "suppliers";
  rfqs.hidden = name !== "rfqs";
  document.querySelector("#crumb").textContent = target.label;
  document.title = "SHL Operations OS — " + target.label + " preview";

  if (name === "customers" || name === "suppliers") {
    document.querySelector("#directory-category").textContent = target.label.toUpperCase();
    document.querySelector("#directory-title").replaceChildren(document.createTextNode(target.label), (() => {
      const dot = document.createElement("span");
      dot.textContent = ".";
      return dot;
    })());
    document.querySelector("#directory-subtitle").textContent = target.description;
    document.querySelector("#table-heading").textContent = target.label + " directory";
    document.querySelector("#directory-empty").textContent = target.empty;
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

document.querySelectorAll("[data-view], [data-go]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view || button.dataset.go));
});
