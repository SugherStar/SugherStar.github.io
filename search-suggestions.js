const searchInput = document.getElementById('search-input');
const searchSuggestions = document.getElementById('search-suggestions');
searchInput.addEventListener('keyup', async (event) => {
const keyword = event.target.value.trim();
if (keyword) {
const url = `https://www.baidu.com/sugrec?prod=pc&wd=${encodeURIComponent(keyword)}`;
const response = await fetch(url);
const data = await response.json();
if (data.g && data.g.length > 0) {
  const suggestions = data.g.map(item => item.q);
  showSuggestions(suggestions);
} else {
  hideSuggestions();
}
} else {
hideSuggestions();
}
});
function showSuggestions(suggestions) {
searchSuggestions.innerHTML = '';
const ul = document.createElement('ul');
suggestions.forEach(suggestion => {
const li = document.createElement('li');
li.textContent = suggestion;
ul.appendChild(li);
});
searchSuggestions.appendChild(ul);
searchSuggestions.style.display = 'block';
}
function hideSuggestions() {
searchSuggestions.innerHTML = '';
searchSuggestions.style.display = 'none';
}
