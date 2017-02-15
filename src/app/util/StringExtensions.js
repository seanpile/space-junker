String.prototype.escapeHtml = function () {
  return this.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

String.prototype.paddingLeft = function (paddingValue) {
  return String(paddingValue + this)
    .slice(-paddingValue.length);
};
