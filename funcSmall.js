const boxes = [boxTranslate, boxNew, boxChange];
let currentBox = null;

function setActive(btn, boxToShow) {
  [btnTranslate, btnNew, btnChange].forEach(b => {
    b.classList.remove("active", "enabled");
    b.disabled = false;
    b.classList.add("enabled");
  });
  btn.classList.remove("enabled");
  btn.classList.add("active");
  btn.disabled = true;

  if (currentBox && currentBox !== boxToShow) {
    currentBox.classList.remove("show");
    currentBox.classList.add("hiding");
    setTimeout(() => {
      currentBox.classList.remove("hiding");
    }, 100); 
  }

  boxToShow.classList.add("show");
  currentBox = boxToShow;
}

btnTranslate.addEventListener("click", () => setActive(btnTranslate, boxTranslate));
btnNew.addEventListener("click", () => setActive(btnNew, boxNew));
btnChange.addEventListener("click", () => setActive(btnChange, boxChange));

setActive(btnTranslate, boxTranslate);

const paragraphs = document.querySelectorAll("li");

  paragraphs.forEach(li => {
    if (li.textContent.includes("[character]")) {
      li.classList.add("greened");
    } else {
      li.classList.add("reddened");
    }
  });

