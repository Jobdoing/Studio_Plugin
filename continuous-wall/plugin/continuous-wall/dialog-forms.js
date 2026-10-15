function validateDialogForm(e) {
  const r = e.checkValidity();
  return e.classList.toggle("form-validation-error", !r), r;
}
document.addEventListener("close", (e) => {
  e.target.querySelector?.("form")?.classList.remove("form-validation-error");
}, true);
