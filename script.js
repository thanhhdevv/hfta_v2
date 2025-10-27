/**
 * Hàm này được gọi từ dashboard.html SAU KHI
 * tất cả thư viện (Chart.js, jsPDF, Firebase compat) đã được tải
 * và Firebase auth đã xác nhận người dùng đăng nhập.
 * Nhận đối tượng user (v9) đã đăng nhập.
 */
function runDashboard(loggedInUser) { // *** NHẬN USER TỪ dashboard.html ***
    console.log("--- runDashboard START --- User:", loggedInUser?.email);

    // --- Get Firebase Services (v8 Compat) ---
    const auth = firebase.auth();
    const db = firebase.firestore();
    const currentUser = loggedInUser; // Sử dụng user v9 được truyền vào

    if (!currentUser || !currentUser.email || !currentUser.uid) {
        console.error("CRITICAL: Invalid user object passed to runDashboard(), redirecting...", loggedInUser);
        window.location.replace('index.html'); // Dùng replace để không lưu vào history
        return;
    }
    const userEmail = currentUser.email;
    const userId = currentUser.uid;
    console.log("User details:", userId, userEmail);


    // =========================================================================
    // --- 1. DOM Elements Cache (Lấy an toàn hơn) ---
    // =========================================================================
    let initializationError = false;
    function getElement(id, required = true) { const el = document.getElementById(id); if (!el && required) { console.error(`CRITICAL: Element ID "${id}" not found!`); initializationError = true; } return el; }
    function querySelector(selector, required = true) { const el = document.querySelector(selector); if (!el && required) { console.error(`CRITICAL: Element selector "${selector}" not found!`); initializationError = true; } return el; }
    function querySelectorAll(selector, required = true) { const els = document.querySelectorAll(selector); if (els.length === 0 && required) { console.warn(`Required elements not found for selector "${selector}".`); } return els;}

    // Lấy các element chính ngay lập tức
    const userEmailDisplay = getElement('user-email-display', false);
    const logoutButtonSimple = getElement('logout-button-simple', false);
    const tabs = querySelectorAll(".tab", false);
    const tabContents = querySelectorAll(".tab-content", false);
    const mailComposeModal = getElement('mail-compose-modal', false);
    const mailComposeCloseBtn = getElement('mail-compose-close', false);
    const mailSendBtn = getElement('mail-send-btn', false); // Nút gửi trong modal
    const mailStatus = getElement('mail-status', false); // Trạng thái gửi
    const mailToInput = getElement('mail-to', false); // Input To
    const mailSubjectInput = getElement('mail-subject', false); // Input Subject
    const mailBodyInput = getElement('mail-body', false); // Input Body
    const mailComposeBtnDesktop = getElement('mail-compose-new-btn-desktop', false); // Nút soạn thư desktop
    const mailComposeFab = getElement('mail-compose-fab', false); // Nút soạn thư mobile (FAB)

    // Các element sẽ được lấy trễ hơn trong hàm initializeMailElements
    let mailListDiv = null; let mailListHeader = null; let mailReaderContainer = null;
    let mailReaderContent = null; let mailReaderPlaceholder = null; let readerSubject = null;
    let mailReaderBackBtn = null;
    let currentMailListener = null; let currentSelectedFolder = 'inbox';
    let aiDataUnsubscribe = null;

    if (initializationError) { alert("Lỗi khởi tạo giao diện nghiêm trọng. Vui lòng kiểm tra Console (F12) và thử tải lại trang."); return; }


    // --- Helper Functions ---
    function setActiveTab(tabId) {
        if (!tabs || !tabContents) { console.error("Tabs/Contents missing in setActiveTab"); return; }
        tabs.forEach(t => t.classList.remove("active"));
        tabContents.forEach(c => c.classList.remove("active"));
        const activeTabButton = document.querySelector(`.tab[data-tab="${tabId}"]`);
        const activeTabContent = document.getElementById(tabId);
        if (activeTabButton) activeTabButton.classList.add("active");
        if (activeTabContent) activeTabContent.classList.add("active");
        else console.warn("Content for tab", tabId, "not found!");

        const mailSection = document.getElementById('mail');
        if (tabId === 'mail' && mailSection && mailSection.classList.contains('active')) {
            initializeMailElements(); // *** GỌI INIT ELEMENTS KHI VÀO TAB MAIL ***
            if (!currentMailListener) {
                console.log("Loading inbox messages because Mail tab activated...");
                loadMessages('inbox');
            }
        } else if (tabId !== 'mail' && currentMailListener) {
            console.log("Unsubscribing from mail listener because navigating away.");
            currentMailListener(); currentMailListener = null;
        }
        if (tabId !== 'mail') closeMailDetail();
     }

     function formatTimestamp(timestamp) {
        if (!timestamp || !timestamp.toDate) return "N/A";
        try { return timestamp.toDate().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }); }
        catch (e) { console.error("Timestamp format error:", timestamp, e); return "Invalid Date"; }
     }

    // --- Initialization ---

    // 1. Tab Switching Logic (Giữ nguyên)
    if (tabs && tabs.length > 0) { tabs.forEach(tab => { tab.addEventListener("click", (e) => { const tabId = e.currentTarget.dataset.tab; if (tabId) setActiveTab(tabId); }); }); }
    else { console.warn("No tab elements found."); }

    // 2. Display User Email & Logout Button (Giữ nguyên)
    if (userEmailDisplay) userEmailDisplay.textContent = userEmail;
    if (logoutButtonSimple) { logoutButtonSimple.onclick = () => { if (currentMailListener) { currentMailListener(); currentMailListener = null; } if (aiDataUnsubscribe) { aiDataUnsubscribe(); aiDataUnsubscribe = null; } console.log("Logging out..."); firebase.auth().signOut().then(() => { window.location.href = 'index.html'; }).catch(err => console.error("Logout error:", err)); }}


    // --- Các Chức năng Cũ (Giữ nguyên) ---

    // 3. Chart demo (Giữ nguyên)
    try { /* ... Code chart gốc ... */ const ctx = document.getElementById('quantChart'); if (ctx && typeof Chart !== 'undefined') { new Chart(ctx, { type: 'line', data: { labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'], datasets: [{ label: 'BTC/USD', data: [67000, 67500, 67200, 68000, 68500, 69000, 68800], borderColor: '#ffb300', tension: 0.3, fill: true, backgroundColor: 'rgba(255, 230, 150, 0.3)'}] }, options: { responsive: true } }); } else if(ctx) { console.warn("Chart.js not loaded yet."); } } catch(e) { console.error("Lỗi Chart:", e); }

    // 4. AI Console demo (Giữ nguyên)
    const runAIButton = document.getElementById("runAI"); if (runAIButton) { /* ... Code AI console gốc ... */ runAIButton.onclick = () => { const input = document.getElementById("aiInput").value; const output = document.getElementById("aiOutput"); if (!input || !output) return; output.innerHTML = `<b>Bạn:</b> ${input}<br><b>AI:</b> Đang xử lý... 🔄`; setTimeout(() => { output.innerHTML = `<b>AI:</b> Khả năng BTC tăng 4h tới là 71%.`; }, 1500); }; } else { console.warn("Nút Run AI không tồn tại."); }

    // 5. Xuất PDF demo (Giữ nguyên)
    const exportPDFButton = document.getElementById("exportPDF"); if (exportPDFButton) { /* ... Code PDF gốc ... */ exportPDFButton.onclick = () => { try { if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') { console.error('jsPDF not loaded.'); alert('PDF chưa sẵn sàng.'); return; } const { jsPDF } = window.jspdf; const pdf = new jsPDF(); pdf.text("BÁO CÁO AI INVESTMENT BRAIN", 10, 10); pdf.text("Tổng hợp dữ liệu mô phỏng BTC", 10, 20); pdf.text("Xác suất tăng: 71%", 10, 30); pdf.text("Khuyến nghị: Long 20% vốn", 10, 40); pdf.save("AI_Investment_Report.pdf"); } catch(e) { console.error("Lỗi PDF:", e); alert("Lỗi xuất PDF"); } }; } else { console.warn("Nút Xuất PDF không tồn tại."); }


    // ===============================================
    // == BẮT ĐẦU CODE MỚI CHO APP MAIL (3 CỘT, Đã sửa lỗi) ==
    // ===============================================

     // --- Lấy Elements Mail và Gắn Sự Kiện (Chạy 1 lần khi tab mail active) ---
     let mailInitialized = false;
     function initializeMailElements() {
        if (mailInitialized) return;
        console.log("Initializing Mail Elements...");

        // *** Lấy elements quan trọng ***
        mailListDiv = getElement('mail-list', true);
        mailListHeader = getElement('mail-list-header', true);
        mailReaderContainer = querySelector('.mail-reader-container', true);
        mailReaderContent = getElement('mail-reader-content', true);
        mailReaderPlaceholder = getElement('mail-reader-placeholder', true);
        readerSubject = getElement('reader-subject', true);
        readerFrom = getElement('reader-from', true);
        readerTo = getElement('reader-to', true);
        readerTimestamp = getElement('reader-timestamp', true);
        readerBody = getElement('reader-body', true);
        mailReaderBackBtn = getElement('mail-reader-back-btn', false);
        
        const mailFoldersDesktop = querySelectorAll('.mail-folder', false);
        const mobileFolderButtons = querySelectorAll('.mail-mobile-folder-selector .folder-btn', false);
        const allFolderButtons = Array.from(mailFoldersDesktop || []).concat(Array.from(mobileFolderButtons || []));


        if(initializationError) { alert("Lỗi khởi tạo giao diện Mail. Không thể tiếp tục."); return; }

        // Gắn sự kiện nút back
        if (mailReaderBackBtn) mailReaderBackBtn.addEventListener('click', closeMailDetail);

        // Gắn sự kiện nút folder (FIX LỖI NÚT THƯ ĐÃ GỬI KHÔNG CLICK ĐƯỢC)
        if (allFolderButtons.length > 0) {
            allFolderButtons.forEach(button => {
                const handleFolderClick = () => {
                    const folder = button.dataset.folder;
                    console.log("Folder button clicked:", folder);
                    if (folder && folder !== currentSelectedFolder) {
                        loadMessages(folder); // Gọi hàm loadMessages khi click
                    }
                };
                button.addEventListener('click', handleFolderClick);
            });
        } else { console.warn("Không tìm thấy nút chọn folder mail."); }

         // Gắn sự kiện nút soạn thư (cả desktop và mobile FAB)
        const openComposeModal = () => { if(mailComposeModal) mailComposeModal.style.display = 'flex'; };
        if (mailComposeBtnDesktop) mailComposeBtnDesktop.onclick = openComposeModal;
        if (mailComposeFab) mailComposeFab.onclick = openComposeModal;

        mailInitialized = true; // Đánh dấu đã khởi tạo
        console.log("Mail Elements Initialized.");
     }


    // --- Logic Hiển thị Chi tiết Mail ---
    function showMailDetail(msgData) { /* ... Giữ nguyên hàm showMailDetail ... */
        const readerSubject = getElement('reader-subject', false); const readerFrom = getElement('reader-from', false); const readerTo = getElement('reader-to', false);
        const readerTimestamp = getElement('reader-timestamp', false); const readerBody = getElement('reader-body', false);
        const mailReaderContent = getElement('mail-reader-content', false); const mailReaderPlaceholder = getElement('mail-reader-placeholder', false);
        const mailReaderContainer = querySelector('.mail-reader-container', false); const mailLayout = querySelector('.mail-layout-v3', false);
        const mailReaderBackBtn = getElement('mail-reader-back-btn', false);

        if (!mailReaderContainer || !readerSubject || !mailReaderContent || !mailReaderPlaceholder || !readerBody) { console.error("Mail reader elements not found in showMailDetail!"); return; }

        readerSubject.textContent = msgData.subject || "[Không có chủ đề]";
        if(readerFrom) readerFrom.textContent = msgData.from || "N/A";
        if(readerTo) readerTo.textContent = msgData.to || "N/A";
        if(readerTimestamp) readerTimestamp.textContent = formatTimestamp(msgData.timestamp);
        if(readerBody) readerBody.textContent = msgData.body || "[Nội dung trống]";

        mailReaderContent.style.display = 'flex'; mailReaderPlaceholder.style.display = 'none';
        mailReaderContainer.classList.add('active');

        if (window.innerWidth <= 992) { if(mailLayout) mailLayout.classList.add('reading-mode'); if(mailReaderBackBtn) mailReaderBackBtn.style.display = 'block'; }
        else { if(mailReaderBackBtn) mailReaderBackBtn.style.display = 'none'; }
    }

    // --- Logic Đóng Chi tiết Mail ---
    function closeMailDetail() { /* ... Giữ nguyên hàm closeMailDetail ... */
         const mailReaderContainer = querySelector('.mail-reader-container', false); const mailReaderContent = getElement('mail-reader-content', false);
         const mailReaderPlaceholder = getElement('mail-reader-placeholder', false); const mailLayout = querySelector('.mail-layout-v3', false);
         const mailReaderBackBtn = getElement('mail-reader-back-btn', false); const mailListDiv = getElement('mail-list', false);

         if (!mailReaderContainer || !mailReaderContent || !mailReaderPlaceholder) return;
         mailReaderContent.style.display = 'none'; mailReaderPlaceholder.style.display = 'flex';
         mailReaderContainer.classList.remove('active');
         if(mailLayout) mailLayout.classList.remove('reading-mode');
         if(mailReaderBackBtn) mailReaderBackBtn.style.display = 'none';
         const activeItem = mailListDiv ? mailListDiv.querySelector('.mail-item.active') : null;
         if(activeItem) activeItem.classList.remove('active');
    }


    // --- Logic Nhận Mail và Hiển thị Danh sách (Đã sửa lỗi index) ---
    function loadMessages(folder = 'inbox') {
        currentSelectedFolder = folder;
        // Lấy element NGAY KHI CẦN (khắc phục lỗi ReferenceError)
        mailListDiv = getElement('mail-list'); mailListHeader = getElement('mail-list-header');

        if (!mailListDiv || !mailListHeader) { console.error("Mail list UI missing in loadMessages!"); return; }

        mailListHeader.textContent = (folder === 'inbox' ? 'Hộp thư đến' : 'Thư đã gửi');
        
        // Cập nhật nút active
        const allFolderButtons = document.querySelectorAll('.mail-folder, .mail-mobile-folder-selector .folder-btn');
        allFolderButtons.forEach(btn => { btn.classList.toggle('active', btn.dataset.folder === folder); });

        if (currentMailListener) { console.log("Unsubscribing previous mail listener."); currentMailListener(); }

        mailListDiv.innerHTML = `<p class="loading-text">Đang tải tin nhắn...</p>`;
        closeMailDetail();

        let q;
        try {
            if (folder === 'inbox') { q = db.collection("messages").where("to", "==", userEmail).orderBy("timestamp", "desc").limit(50); }
            else { q = db.collection("messages").where("from", "==", userEmail).orderBy("timestamp", "desc").limit(50); }
        } catch (e) { console.error("Query error:", e); if (mailListDiv) mailListDiv.innerHTML = `<p class="loading-text" style='color:red;'>Lỗi truy vấn.</p>`; return; }

        console.log(`Setting up listener for ${folder}...`);
        currentMailListener = q.onSnapshot((querySnapshot) => {
            console.log(`${folder} snapshot received, size:`, querySnapshot.size);
            const currentMailListDiv = document.getElementById('mail-list'); // Lấy lại element mới nhất
            if (!currentMailListDiv) { console.warn("mail-list element gone before snapshot."); if(currentMailListener) { currentMailListener(); currentMailListener = null; } return; }

            if (querySnapshot.empty) { currentMailListDiv.innerHTML = `<p class="loading-text">Không có tin nhắn nào.</p>`; return; }
            currentMailListDiv.innerHTML = "";
            querySnapshot.forEach((doc) => {
                const msg = doc.data();
                if (!msg || !msg.subject || typeof msg.body === 'undefined') { console.warn("Invalid message data:", msg); return; }
                const msgElement = document.createElement('div'); msgElement.className = 'mail-item';
                const sentTime = formatTimestamp(msg.timestamp);
                const participant = (folder === 'inbox') ? msg.from : `Đến: ${msg.to}`;
                msgElement.innerHTML = `<div class="mail-item-sender">${participant || 'N/A'}</div> <div class="mail-item-subject">${msg.subject}</div> <div class="mail-item-preview">${(msg.body || '').substring(0, 40)}...</div> <small>${sentTime}</small>`;
                msgElement.onclick = () => { showMailDetail(msg); document.querySelectorAll('#mail-list .mail-item').forEach(item => item.classList.remove('active')); msgElement.classList.add('active'); };
                currentMailListDiv.appendChild(msgElement);
             });
        }, (error) => {
            console.error(`Lỗi khi nhận tin nhắn (${folder}): `, error);
             const currentMailListDiv = document.getElementById('mail-list');
             if (currentMailListDiv) {
                if (error.code === 'failed-precondition') {
                    currentMailListDiv.innerHTML = `<p class="loading-text" style='color:red;'>Lỗi: Cần tạo chỉ mục (index) Firestore. <br>Kiểm tra Console (F12) để lấy link.</p>`;
                    const linkMatch = error.message.match(/https:\/\/[^\s]+/);
                    if (linkMatch) { console.error("Firestore index needed:", linkMatch[0]); alert("Lỗi Firestore: Cần tạo Index (xem Console F12)."); }
                    else { alert("Lỗi Firestore: Cần tạo Index (xem Console F12)."); }
                } else if (error.code === 'permission-denied') { currentMailListDiv.innerHTML = `<p class="loading-text" style='color:red;'>Lỗi: Không có quyền đọc. Kiểm tra Security Rules.</p>`; }
                 else { currentMailListDiv.innerHTML = `<p class="loading-text" style='color:red;'>Lỗi tải tin nhắn (${error.code}).</p>`; }
             }
             if (currentMailListener) { currentMailListener(); currentMailListener = null;}
         });
    }

    // --- Kích hoạt chuyển Folder ---
    const mailFoldersElements = document.querySelectorAll('.mail-folder, .mail-mobile-folder-selector .folder-btn');
    if (mailFoldersElements && mailFoldersElements.length > 0) {
        mailFoldersElements.forEach(button => {
            const handleFolderClick = () => {
                const folder = button.dataset.folder;
                if (folder && folder !== currentSelectedFolder) { loadMessages(folder); }
            };
            button.addEventListener('click', handleFolderClick);
        });
    } else { console.warn("Không tìm thấy nút chọn folder mail."); }


     // --- Logic Modal Soạn thư (Giữ nguyên) ---
    if (mailComposeModal && mailComposeCloseBtn) {
        if (mailComposeCloseBtn) mailComposeCloseBtn.onclick = () => { if(mailComposeModal) mailComposeModal.style.display = 'none'; };
        window.onclick = (event) => { if (event.target == mailComposeModal) mailComposeModal.style.display = "none"; };
    } else { console.warn("Compose modal elements not found."); }

    // --- Logic Gửi Mail (ĐÃ FIX) ---
    if (mailSendBtn && mailToInput && mailSubjectInput && mailBodyInput && mailStatus) {
        mailSendBtn.onclick = async () => { /* ... Code gửi mail như cũ ... */
            const to = mailToInput.value.trim(); const subject = mailSubjectInput.value.trim(); const body = mailBodyInput.value.trim();
            if (!to || !subject || !body) { mailStatus.textContent = "Vui lòng nhập đủ thông tin!"; mailStatus.style.color = "red"; return; }
            if (!/\S+@\S+\.\S+/.test(to)) { mailStatus.textContent = "Email nhận không hợp lệ!"; mailStatus.style.color = "red"; return; }
            sendBtn.textContent = "Đang gửi..."; sendBtn.disabled = true; mailStatus.textContent = "";
            try { 
                await db.collection("messages").add({ to: to, from: userEmail, subject: subject, body: body, timestamp: firebase.firestore.FieldValue.serverTimestamp() }); 
                mailStatus.textContent = "Gửi thành công!"; mailStatus.style.color = "green"; 
                setTimeout(() => { // Đóng modal và reset form sau khi gửi
                    mailToInput.value = ""; mailSubjectInput.value = ""; mailBodyInput.value = ""; 
                    if(mailComposeModal) mailComposeModal.style.display = 'none'; 
                    if(mailStatus) mailStatus.textContent = ""; 
                }, 1500); 
            } 
            catch (e) { 
                console.error("Lỗi khi gửi mail:", e); 
                if (e.code === 'permission-denied') {
                    mailStatus.textContent = "Lỗi: Không có quyền ghi thư! Kiểm tra Security Rules.";
                } else {
                    mailStatus.textContent = "Gửi lỗi! Vui lòng kiểm tra Console (F12).";
                }
                mailStatus.style.color = "red"; 
            }
            finally { setTimeout(() => { if (mailSendBtn) { sendBtn.textContent = "Gửi"; sendBtn.disabled = false; } }, 1500); }
         };
    } else { console.warn("Nút gửi mail không tồn tại."); }


    // --- Kích hoạt tải mail ban đầu nếu tab Mail active ---
    setTimeout(() => {
        const currentActiveTabButton = document.querySelector('.tab.active');
        if (currentActiveTabButton && currentActiveTabButton.dataset.tab === 'mail') {
            if (!currentMailListener) { initializeMailElements(); loadMessages('inbox'); }
        }
    }, 300); // Tăng độ trễ hơn nữa


    // ===============================================
    // == KẾT THÚC CODE MỚI CHO APP MAIL ==
    // ===============================================


    // ===============================================
    // == CODE CŨ: ĐỒNG BỘ DỮ LIỆU AI REAL-TIME (Giữ nguyên) ==
    // ===============================================
    const systemDataRef = db.collection('system_data');
    if (document.getElementById('live-btc-price-value') || document.getElementById('live-sentiment-value')) {
        aiDataUnsubscribe = systemDataRef.onSnapshot((querySnapshot) => { // Gán hàm hủy vào biến
            querySnapshot.forEach((doc) => { /* ... Code cập nhật UI AI data như cũ ... */
                const data = doc.data(); const genericLastUpdatedText = data.last_updated ? `Cập nhật: ${formatTimestamp(data.last_updated)}` : "Đang tải..."; try {
                const btcPriceEl = getElement('live-btc-price-value', false); const lastUpdatedElQ = getElement('live-last-updated', false); const quantSummaryElQ = getElement('quant-summary', false);
                const sentimentEl = getElement('live-sentiment-value', false); const sentimentSourceElS = getElement('live-sentiment-source', false); const sentimentSummaryElS = getElement('sentiment-summary', false); const sentimentFillElS = querySelector('#sentiment .fill', false); const sentimentScoreTextElS = getElement('sentiment-score-text', false);
                const recommendationEl = getElement('live-recommendation-value', false); const recommendationReasonElA = getElement('live-recommendation-reason', false);
                const riskListElR = getElement('risk-list', false);
                switch (doc.id) {
                     case 'quant_ai': if (btcPriceEl && data.btc_price !== undefined) btcPriceEl.textContent = `$${data.btc_price.toLocaleString('en-US')}`; if (lastUpdatedElQ) lastUpdatedElQ.textContent = `Quant: ${data.last_updated ? formatTimestamp(data.last_updated) : 'N/A'}`; if (quantSummaryElQ) quantSummaryElQ.textContent = `AI nhận định: ${data.trend || 'N/A'}, RSI=${data.rsi || 'N/A'}`; break;
                     case 'sentiment_ai': if (sentimentEl && data.score !== undefined) sentimentEl.textContent = `${data.score}%`; if (sentimentSourceElS && data.source) sentimentSourceElS.textContent = `Nguồn: ${data.source}`; if (sentimentSummaryElS) sentimentSummaryElS.textContent = `Phân tích tâm lý từ ${data.source || 'N/A'}. Điểm: ${data.score || 'N/A'}/100`; if(sentimentFillElS) sentimentFillElS.style.width = `${data.score || 0}%`; if(sentimentScoreTextElS) sentimentScoreTextElS.textContent = `${data.score || 0}/100`; break;
                     case 'advisor_ai': if (recommendationEl && data.recommendation) recommendationEl.textContent = data.recommendation; if (recommendationReasonElA && data.reasoning) recommendationElA.textContent = data.reasoning; break;
                     case 'risk_ai': if (riskListElR && data.volatility !== undefined && data.max_drawdown !== undefined) { riskListElR.innerHTML = `<li>Độ biến động: <b>${data.volatility}%</b></li><li>Max Drawdown: <b>${data.max_drawdown}%</b></li><li>Vốn tối đa: <b>${data.max_leverage || 'N/A'}</b></li><li><small>Risk AI: ${data.last_updated ? formatTimestamp(data.last_updated) : 'N/A'}</small></li>`; } else if (riskListElR) { riskListElR.innerHTML = '<li>Đang tải...</li>'; } break;
                 } } catch (e) { console.error(`Error UI update for ${doc.id}:`, e); }
             });
        }, (error) => { console.error("Lỗi lắng nghe AI data: ", error); const btcPriceEl = getElement('live-btc-price-value', false); if (btcPriceEl) btcPriceEl.textContent = "Lỗi"; });
    } else { console.warn("Không tìm thấy element AI data, bỏ qua listener."); }

    console.log("Dashboard initialization complete.");

} // --- END of runDashboard() ---
