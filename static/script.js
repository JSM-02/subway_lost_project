let panZoom;
let pagination = null;

// 검색 상태 관리
const SEARCH_CONFIG = {
    keyword: '',
    type: 'item',
    page: 1,
    itemsPerPage: 10
};

const API_BASE_URL = ''; 

// 데이터 호출 함수
async function fetchLostItems(keyword, type = 'item', page = 1) {
    if (!keyword) {
        alert('검색어를 입력하세요.');
        return;
    }

    const isNewSearch = (SEARCH_CONFIG.keyword !== keyword || SEARCH_CONFIG.type !== type);
    
    SEARCH_CONFIG.keyword = keyword;
    SEARCH_CONFIG.type = type;
    SEARCH_CONFIG.page = page;

    const listDiv = document.getElementById('list');
    const titleEl = document.getElementById('st-title');

    // 제목 업데이트 및 리스트 초기화
    titleEl.textContent = type === 'location' ? `${keyword}역 습득물` : `'${keyword}' 검색 결과`;
    
    listDiv.replaceChildren();
    const loadingMsg = document.createElement('p');
    loadingMsg.className = 'status-msg';
    loadingMsg.textContent = '데이터 로딩 중...';
    listDiv.appendChild(loadingMsg);

    try {
        const queryUrl = `${API_BASE_URL}/${type}/${encodeURIComponent(keyword)}?page=${page}`;
        const response = await fetch(queryUrl);
        
        if (!response.ok) throw new Error(`Status: ${response.status}`);

        const data = await response.json();
        
        renderLostList(data.items);
        setupPagination(data.totalItems, isNewSearch);

    } catch (error) {
        console.error('Fetch Error:', error);
        listDiv.replaceChildren();
        const errorMsg = document.createElement('p');
        errorMsg.className = 'status-msg error';
        errorMsg.textContent = '데이터를 불러오는데 실패했습니다.';
        listDiv.appendChild(errorMsg);
    }
}

// 리스트 렌더링
function renderLostList(items) {
    const listDiv = document.getElementById('list');
    listDiv.replaceChildren(); // 초기화

    if (!items || items.length === 0) {
        const noData = document.createElement('p');
        noData.className = 'status-msg';
        noData.textContent = '검색 결과가 없습니다.';
        listDiv.appendChild(noData);
        return;
    }

    items.forEach(item => {
        const article = document.createElement('article');
        article.className = 'lost-card';
        
        article.onclick = function() {
            openModal(item);
        };

        // 텍스트 정보 영역
        const infoDiv = document.createElement('div');
        infoDiv.className = 'card-info';

        const h4 = document.createElement('h4');
        h4.textContent = item.fdPrdtNm || '물품명 없음';
        infoDiv.appendChild(h4);

        // 습득일
        const pDate = document.createElement('p');
        pDate.textContent = '습득일: ' + (item.fdYmd || '-');
        infoDiv.appendChild(pDate);

        // 보관장소
        const pPlace = document.createElement('p');
        pPlace.textContent = '보관장소: ' + (item.depPlace || '-');
        infoDiv.appendChild(pPlace);

        // 이미지 영역
        const img = document.createElement('img');
        img.className = 'item-img';
        img.src = item.fdFilePathImg || '/static/img/no-image.png';
        img.onerror = function() {
            this.src = '/static/img/no-image.png';
        };

        article.appendChild(infoDiv);
        article.appendChild(img);
        
        listDiv.appendChild(article);
    });
}

// 상세정보 모달 열기
function openModal(item) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    modalBody.replaceChildren();

    // 이미지 추가
    const img = document.createElement('img');
    img.className = 'modal-img';
    img.src = item.fdFilePathImg || '/static/img/no-image.png';
    img.onerror = function() { this.src = '/static/img/no-image.png'; };
    modalBody.appendChild(img);

    // 상세 정보 영역
    const infoList = document.createElement('div');
    infoList.className = 'modal-info-list';
    
    const itemsToShow = [
        { label: '물품명', value: item.fdPrdtNm },
        { label: '물품분류', value: item.prdtClNm },
        { label: '색상', value: item.clrNm },
        { label: '습득일시', value: `${item.fdYmd} (${item.fdHor || ''}시)` },
        { label: '습득장소', value: item.fdPlace },
        { label: '보관기관', value: item.orgNm },
        { label: '보관장소', value: item.depPlace },
        { label: '연락처', value: item.tel },
        { label: '특이사항', value: item.uniq }
    ];

    itemsToShow.forEach(data => {
        const row = document.createElement('div');
        row.className = 'modal-info-row';
        const st = document.createElement('strong');
        st.textContent = data.label;
        const sp = document.createElement('span');
        sp.textContent = ' ' + (data.value || '정보 없음');
        row.appendChild(st);
        row.appendChild(sp);
        infoList.appendChild(row);
    });

    modalBody.appendChild(infoList);
    modal.style.display = 'flex';
}

// 모달 닫기
window.addEventListener('click', function(e) {
    let modal = document.getElementById('modal');
    if (e.target == modal) {
        modal.style.display = 'none';
    }
});

// TUI 페이지네이션
function setupPagination(totalItems, shouldReset) {
    const container = document.getElementById('pagination');

    if (!totalItems || totalItems === 0) {
        container.replaceChildren();
        pagination = null;
        return;
    }

    if (shouldReset && pagination) {
        container.replaceChildren();
        pagination = null;
    }

    if (!pagination) {
        pagination = new tui.Pagination(container, {
            totalItems: totalItems,
            itemsPerPage: SEARCH_CONFIG.itemsPerPage,
            visiblePages: 5,
            centerAlign: false,
            usageStatistics: false
        });

        pagination.on('afterMove', (event) => {
            if (SEARCH_CONFIG.page !== event.page) {
                fetchLostItems(SEARCH_CONFIG.keyword, SEARCH_CONFIG.type, event.page);
            }
        });
    } else {
        pagination.setTotalItems(totalItems);
        pagination.movePageTo(SEARCH_CONFIG.page, false);
    }
}

// 이벤트 초기화
function init() {
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search');

    const onSearch = () => {
        const keyword = searchInput.value.trim();
        if (keyword) fetchLostItems(keyword, 'item');
        else alert('검색어를 입력하세요.');
    };

    searchBtn.addEventListener('click', onSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onSearch();
        }
    });

    document.getElementById('modal-close').onclick = () => {
        document.getElementById('modal').style.display = 'none';
    };
}

// SVG 로드 및 역 클릭 이벤트
document.getElementById('subway-svg').addEventListener('load', function () {
    const svgDoc = this.contentDocument;
    if (!svgDoc) return;

    const svgEl = svgDoc.querySelector('svg');
    panZoom = svgPanZoom(svgEl, {
        zoomEnabled: true,
        controlIconsEnabled: true,
        fit: true,
        center: true,
        // svg 팬 제한
        beforePan: function(oldPan, newPan) {
            const gutterWidth = 200;  
            const gutterHeight = 200;
            const sizes = this.getSizes();

            const leftLimit = -((sizes.viewBox.x + sizes.viewBox.width) * sizes.realZoom) + gutterWidth;
            const rightLimit = sizes.width - gutterWidth - (sizes.viewBox.x * sizes.realZoom);
            const topLimit = -((sizes.viewBox.y + sizes.viewBox.height) * sizes.realZoom) + gutterHeight;
            const bottomLimit = sizes.height - gutterHeight - (sizes.viewBox.y * sizes.realZoom);

            return {
                x: Math.max(leftLimit, Math.min(rightLimit, newPan.x)),
                y: Math.max(topLimit, Math.min(bottomLimit, newPan.y))
            };
        }
    });

    const textElements = svgDoc.querySelectorAll('text');
    textElements.forEach(t => {
        if (t.closest('#legend_ko')) return;

        t.style.cursor = 'pointer';
        t.addEventListener('click', () => {
            const name = t.textContent.replace(/\s+/g, "");
            fetchLostItems(name, 'location');
        });
    });
});

init();