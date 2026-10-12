const copy = {
  overview: {
    title: "Overview",
    subtitle: "Your operations, in one place.",
    eyebrow: "GET STARTED",
    panelTitle: "Build your network",
    panelCopy: "Add customers and suppliers in the full application to organize SHL relationships. This GitHub Pages preview is not connected to the application database."
  },
  customers: {
    title: "Customers",
    subtitle: "A preview of the customer directory.",
    eyebrow: "CUSTOMER DIRECTORY",
    panelTitle: "No customer records",
    panelCopy: "Customer records will appear here when the full application is connected to a database. This static preview does not load or save records."
  },
  suppliers: {
    title: "Suppliers",
    subtitle: "A preview of the supplier directory.",
    eyebrow: "SUPPLIER DIRECTORY",
    panelTitle: "No supplier records",
    panelCopy: "Supplier records will appear here when the full application is connected to a database. This static preview does not load or save records."
  }
};

const navItems = [...document.querySelectorAll("[data-view]")];
for (const item of navItems) {
  item.addEventListener("click", () => {
    const view = item.dataset.view;
    const content = copy[view];
    if (!content) return;
    navItems.forEach((navItem) => {
      const selected = navItem === item;
      navItem.classList.toggle("selected", selected);
      navItem.setAttribute("aria-current", selected ? "page" : "false");
    });
    document.title = `SHL Operations — ${content.title} preview`;
    document.querySelector("#crumb").textContent = content.title;
    document.querySelector("#page-title").textContent = content.title;
    document.querySelector("#page-subtitle").textContent = content.subtitle;
    document.querySelector("#panel-eyebrow").textContent = content.eyebrow;
    document.querySelector("#panel-title").textContent = content.panelTitle;
    document.querySelector("#panel-copy").textContent = content.panelCopy;
  });
}
