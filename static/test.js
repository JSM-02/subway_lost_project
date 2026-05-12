async function fetchItems() {
    const response = await fetch('/location/강남?page=1');

    const data = await response.json();

    console.log("서버 데이터 : ", data);
    console.log("아이템리스트 : ", data.item);

    viewList(data.item);
}

function viewList(items) {
    const listDiv = document.getElementById('list');
    
    // 1. 기존에 있던 내용 싹 비우기 (중요!)
    listDiv.replaceChildren();

    // 2. 데이터가 없을 때 처리
    if (!items || items.length === 0) {
        listDiv.textContent = "데이터가 없어요.";
        return;
    }

    // 3. 아이템 하나하나를 카드로 만들기
    items.forEach(item => {
        const article = document.createElement('article');
        article.className = 'lost-card';

        // 서버 데이터(item)에서 필요한 값만 쏙쏙 뽑아서 넣기
        article.innerHTML = `
            <div class="card-info">
                <h4>${item.fdPrdtNm}</h4>
                <p>습득일: ${item.fdYmd}</p>
                <p>보관소: ${item.depPlace}</p>
            </div>
            <img src="${item.fdFilePathImg}" style="width:100px" onerror="this.src='/static/img/no-image.png'">
        `;
        
        listDiv.appendChild(article);
    });
}

fetchItems();