/**
 * Hàm này được gọi từ dashboard.html SAU KHI
 * tất cả thư viện (Chart.js, jsPDF, Firebase compat) đã được tải
 * và Firebase auth đã xác nhận người dùng đăng nhập.
 * Nhận đối tượng user (v9) đã đăng nhập.
 */
function runDashboard(loggedInUser) { // *** NHẬN USER TỪ dashboard.html ***
    console.log("runDashboard() initializing with user:", loggedInUser);

    // --- Get Firebase Services (v8 Compat) ---
    const auth = firebase.auth();
    const db = firebase.firestore();
    const currentUser = loggedInUser; // Sử dụng user v9 được truyền vào

    // *** KIỂM TRA USER NGAY LẬP TỨC ***
    if (!currentUser || !currentUser.email || !currentUser.uid) {
        console.error("CRITICAL: Invalid user object passed to runDashboard(), redirecting...", loggedInUser);
        window.location.replace('index.html'); // Dùng replace để không lưu vào history
        return;
    }
    const userEmail = currentUser.email;
    const userId = currentUser.uid;
    console.log("Current user (passed from v9):", userId, userEmail);


    // --- DOM Elements Cache (Lấy an toàn hơn) ---
    let initializationError = false;
    function getElement(id, required = true) {
        const el = document.getElementById(id);
        if (!el && required) { console.error(`CRITICAL: Element ID "${id}" not found!`); initializationError = true; }
        return el;
    }
     function querySelector(selector, required = true) {
        const el = document.querySelector(selector);
        if (!el && required) { console.error(`CRITICAL: Element selector "${selector}" not found!`); initializationError = true; }
        return el;
    }
     function querySelectorAll(selector, required = true) {
        const els = document.querySelectorAll(selector);
        if (els.length === 0 && required) { console.warn(`Required elements not found for selector "${selector}".`); }
        return els;
     }

    // Lấy các element chính ngay lập tức
    const userEmailDisplay = getElement('user-email-display', false);
    const logoutButtonSimple = getElement('logout-button-simple', false);
    const tabs = querySelectorAll(".tab", false);
    const tabContents = querySelectorAll(".tab-content", false);
    const mailComposeModal = getElement('mail-compose-modal', false);
    const mailComposeCloseBtn = getElement('mail-compose-close', false);
    const mailSendBtn = getElement('mail-send-btn', false);
    const mailStatus = getElement('mail-status', false);
    const mailToInput = getElement('mail-to', false);
    const mailSubjectInput = getElement('mail-subject', false);
    const mailBodyInput = getElement('mail-body', false);
    const mailComposeBtnDesktop = getElement('mail-compose-new-btn-desktop', false);
    const mailComposeFab = getElement('mail-compose-fab', false);

    // Các element sẽ được lấy trễ hơn trong hàm
    let mailListDiv = null;
    let mailListHeader = null;
    let mailFolders = null; // Bao gồm cả desktop và mobile
    let mailReaderContainer = null;
    let mailReaderContent = null;
    let mailReaderPlaceholder = null;
    let readerSubject = null;
    let readerFrom = null;
    let readerTo = null;
    let readerTimestamp = null;
    let readerBody = null;
    let mailReaderBackBtn = null;
    let currentMailListener = null;
    let currentSelectedFolder = 'inbox';
    let aiDataUnsubscribe = null;

    if (initializationError) {
        alert("Lỗi khởi tạo giao diện nghiêm trọng. Vui lòng kiểm tra Console (F12) và thử tải lại trang.");
        return;
    }

    // --- Helper Functions ---
    function setActiveTab(tabId) { /* ... Giữ nguyên hàm setActiveTab ... */
        if (!tabs || !tabContents) { console.error("Tabs/Contents missing in setActiveTab"); return; }
        tabs.forEach(t => t.classList.remove("active"));
        tabContents.forEach(c => c.classList.remove("active"));
        const activeTabButton = document.querySelector(`.tab[data-tab="${tabId}"]`);
        const activeTabContent = document.getElementById(tabId);
        if (activeTabButton) activeTabButton.classList.add("active");
        if (activeTabContent) activeTabContent.classList.add("active");
        else console.warn("Content for tab", tabId, "not found!");
        const mailSection = document.getElementById('mail');
        if (tabId === 'mail' && !currentMailListener && mailSection && mailSection.classList.contains('active')) {
            console.log("Loading inbox messages because Mail tab activated...");
            initializeMailElements(); // *** GỌI INIT MAIL ELEMENTS ***
            loadMessages('inbox');
        } else if (tabId !== 'mail' && currentMailListener) {
            console.log("Unsubscribing from mail listener...");
            currentMailListener(); currentMailListener = null;
        }
        if (tabId !== 'mail') closeMailDetail();
     }

     function formatTimestamp(timestamp) { /* ... Giữ nguyên hàm formatTimestamp ... */
        if (!timestamp || !timestamp.toDate) return "N/A";
        try { return timestamp.toDate().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }); }
        catch (e) { console.error("Timestamp format error:", timestamp, e); return "Invalid Date"; }
     }

    // --- Initialization ---

    // 1. Tab Switching Logic (Giữ nguyên)
    if (tabs && tabs.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener("click", (e) => {
                const tabId = e.currentTarget.dataset.tab;
                 if (tabId) setActiveTab(tabId);
            });
        });
    } else { console.warn("No tab elements found."); }

    // 2. Display User Email & Logout Button (Giữ nguyên)
    if (userEmailDisplay) userEmailDisplay.textContent = userEmail;
    if (logoutButtonSimple) {
        logoutButtonSimple.onclick = () => {
             if (currentMailListener) { currentMailListener(); currentMailListener = null; }
             if (aiDataUnsubscribe) { aiDataUnsubscribe(); aiDataUnsubscribe = null; }
             console.log("Logging out...");
             firebase.auth().signOut().then(() => { window.location.href = 'index.html'; })
               .catch(err => console.error("Logout error:", err));
        }
    }

    // --- Các Chức năng Cũ (Giữ nguyên) ---

    // 3. Chart demo (Giữ nguyên)
    try { /* ... Code chart gốc ... */
        const ctx = document.getElementById('quantChart');
        if (ctx && typeof Chart !== 'undefined') { new Chart(ctx, { type: 'line', data: { labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'], datasets: [{ label: 'BTC/USD', data: [67000, 67500, 67200, 68000, 68500, 69000, 68800], borderColor: '#ffb300', tension: 0.3, fill: true, backgroundColor: 'rgba(255, 230, 150, 0.3)'}] }, options: { responsive: true } }); }
        else if(ctx) { console.warn("Chart.js not loaded yet."); }
    } catch(e) { console.error("Lỗi Chart:", e); }

    // 4. AI Console demo (Giữ nguyên)
    const runAIButton = document.getElementById("runAI");
    if (runAIButton) { /* ... Code AI console gốc ... */
         runAIButton.onclick = () => { const input = document.getElementById("aiInput").value; const output = document.getElementById("aiOutput"); if (!input) return; output.innerHTML = `<b>Bạn:</b> ${input}<br><b>AI:</b> Đang xử lý... 🔄`; setTimeout(() => { output.innerHTML = `<b>AI:</b> Khả năng BTC tăng 4h tới là 71%.`; }, 1500); };
     } else { console.warn("Nút Run AI không tồn tại."); }

    // 5. Xuất PDF demo (Giữ nguyên)
    const exportPDFButton = document.getElementById("exportPDF");
    if (exportPDFButton) { /* ... Code PDF gốc ... */
         exportPDFButton.onclick = () => { try { if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') { console.error('jsPDF not loaded.'); alert('PDF chưa sẵn sàng.'); return; } const { jsPDF } = window.jspdf; const pdf = new jsPDF(); pdf.text("BÁO CÁO AI INVESTMENT BRAIN", 10, 10); pdf.text("Tổng hợp dữ liệu mô phỏng BTC", 10, 20); pdf.text("Xác suất tăng: 71%", 10, 30); pdf.text("Khuyến nghị: Long 20% vốn", 10, 40); pdf.save("AI_Investment_Report.pdf"); } catch(e) { console.error("Lỗi PDF:", e); alert("Lỗi xuất PDF"); } };
     } else { console.warn("Nút Xuất PDF không tồn tại."); }


    // ===============================================
    // == BẮT ĐẦU CODE MỚI CHO APP MAIL (3 CỘT, Đã sửa lỗi) ==
    // ===============================================

     // --- Lấy Elements Mail và Gắn Sự Kiện (Chạy 1 lần khi tab mail được mở) ---
     let mailInitialized = false;
     function initializeMailElements() {
        if (mailInitialized) return; // Chỉ chạy 1 lần

        console.log("Initializing Mail Elements...");
        mailListDiv = getElement('mail-list');
        mailListHeader = getElement('mail-list-header');
        mailFolders = querySelectorAll('.mail-folder', false); // Desktop folders
        const mobileFolderButtons = querySelectorAll('.mail-mobile-folder-selector .folder-btn', false); // Mobile folders
        mailReaderContainer = querySelector('.mail-reader-container');
        mailReaderContent = getElement('mail-reader-content');
        mailReaderPlaceholder = getElement('mail-reader-placeholder');
        readerSubject = getElement('reader-subject');
        readerFrom = getElement('reader-from');
        readerTo = getElement('reader-to');
        readerTimestamp = getElement('reader-timestamp');
        readerBody = getElement('reader-body');
        mailReaderBackBtn = getElement('mail-reader-back-btn');

        // Gộp 2 nhóm nút folder
        const allFolderButtons = Array.from(mailFolders || []).concat(Array.from(mobileFolderButtons || []));

        // Gắn sự kiện nút back
        if (mailReaderBackBtn) {
            mailReaderBackBtn.addEventListener('click', closeMailDetail);
        } else { console.warn("Nút back mail reader không tồn tại"); }

        // Gắn sự kiện nút folder
        if (allFolderButtons.length > 0) {
            allFolderButtons.forEach(button => {
                const handleFolderClick = () => {
                    const folder = button.dataset.folder;
                    console.log("Folder button clicked:", folder);
                    if (folder && folder !== currentSelectedFolder) {
                        loadMessages(folder);
                    }
                };
                 // Gỡ listener cũ (phòng ngừa)
                // button.removeEventListener('click', handleFolderClick); // Cần lưu trữ tham chiếu hàm để gỡ
                button.addEventListener('click', handleFolderClick);
            });
        } else { console.warn("Không tìm thấy nút chọn folder mail."); }

         // Gắn sự kiện nút soạn thư (cả desktop và mobile FAB)
        const openComposeModal = () => { if(mailComposeModal) mailComposeModal.style.display = 'flex'; };
        if (mailComposeBtnDesktop) mailComposeBtnDesktop.onclick = openComposeModal;
        if (mailComposeFab) mailComposeFab.onclick = openComposeModal;

        mailInitialized = true;
        console.log("Mail Elements Initialized.");
     }


    // --- Logic Hiển thị Chi tiết Mail ---
    function showMailDetail(msgData) {
        // *** Lấy lại element ngay trước khi dùng để chắc chắn ***
        readerSubject = getElement('reader-subject');
        readerFrom = getElement('reader-from');
        readerTo = getElement('reader-to');
        readerTimestamp = getElement('reader-timestamp');
        readerBody = getElement('reader-body');
        mailReaderContent = getElement('mail-reader-content');
        mailReaderPlaceholder = getElement('mail-reader-placeholder');
        mailReaderContainer = querySelector('.mail-reader-container');
        mailLayout = querySelector('.mail-layout-v3');
        mailReaderBackBtn = getElement('mail-reader-back-btn');


        if (!mailReaderContainer || !readerSubject || !readerFrom || !readerTo || !readerTimestamp || !readerBody || !mailReaderContent || !mailReaderPlaceholder) {
             console.error("Một hoặc nhiều element để hiển thị chi tiết mail không tồn tại!"); return;
        }

        readerSubject.textContent = msgData.subject || "[Không có chủ đề]";
        readerFrom.textContent = msgData.from || "N/A";
        readerTo.textContent = msgData.to || "N/A";
        readerTimestamp.textContent = formatTimestamp(msgData.timestamp);
        readerBody.textContent = msgData.body || "[Nội dung trống]";

        mailReaderContent.style.display = 'flex';
        mailReaderPlaceholder.style.display = 'none';
        mailReaderContainer.classList.add('active');

        if (window.innerWidth <= 992) {
            if(mailLayout) mailLayout.classList.add('reading-mode');
            if(mailReaderBackBtn) mailReaderBackBtn.style.display = 'block';
        } else {
             if(mailReaderBackBtn) mailReaderBackBtn.style.display = 'none';
        }
    }

    // --- Logic Đóng Chi tiết Mail ---
    function closeMailDetail() {
         // *** Lấy lại element ngay trước khi dùng ***
         mailReaderContainer = querySelector('.mail-reader-container', false);
         mailReaderContent = getElement('mail-reader-content', false);
         mailReaderPlaceholder = getElement('mail-reader-placeholder', false);
         mailLayout = querySelector('.mail-layout-v3', false);
         mailReaderBackBtn = getElement('mail-reader-back-btn', false);
         mailListDiv = getElement('mail-list', false); // Lấy cả mailListDiv

         if (!mailReaderContainer || !mailReaderContent || !mailReaderPlaceholder) return;
         mailReaderContent.style.display = 'none';
         mailReaderPlaceholder.style.display = 'flex';
         mailReaderContainer.classList.remove('active');
         if(mailLayout) mailLayout.classList.remove('reading-mode');
         if(mailReaderBackBtn) mailReaderBackBtn.style.display = 'none';
         const activeItem = mailListDiv ? mailListDiv.querySelector('.mail-item.active') : null;
         if(activeItem) activeItem.classList.remove('active');
    }

    // --- Logic Nhận Mail và Hiển thị Danh sách (Đã sửa lỗi index) ---
    function loadMessages(folder = 'inbox') {
        currentSelectedFolder = folder;
        // *** Lấy element NGAY KHI CẦN ***
        mailListDiv = getElement('mail-list'); // Lấy lại ở đây
        mailListHeader = getElement('mail-list-header'); // Lấy lại ở đây
        const desktopFolderButtons = querySelectorAll('.mail-folder', false);
        const mobileFolderButtons = querySelectorAll('.mail-mobile-folder-selector .folder-btn', false);

        if (!mailListDiv || !mailListHeader ) { // Chỉ cần kiểm tra 2 cái này là đủ
            console.error("Mail list UI elements missing in loadMessages!");
            return;
        }

        mailListHeader.textContent = (folder === 'inbox' ? 'Hộp thư đến' : 'Thư đã gửi');
        // Cập nhật nút active cho cả 2 nhóm
        const allFolderButtons = Array.from(desktopFolderButtons || []).concat(Array.from(mobileFolderButtons || []));
        allFolderButtons.forEach(btn => { btn.classList.toggle('active', btn.dataset.folder === folder); });

        // Hủy listener cũ
        if (currentMailListener) { console.log("Unsubscribing previous mail listener."); currentMailListener(); }

        mailListDiv.innerHTML = `<p class="loading-text">Đang tải tin nhắn...</p>`;
        closeMailDetail();

        let q;
        try { /* ... Tạo query q như cũ ... */
            if (folder === 'inbox') { q = db.collection("messages").where("to", "==", userEmail).orderBy("timestamp", "desc").limit(50); }
            else { q = db.collection("messages").where("from", "==", userEmail).orderBy("timestamp", "desc").limit(50); }
        } catch (e) { /* ... Xử lý lỗi tạo query như cũ ... */
             console.error("Query error:", e); if (mailListDiv) mailListDiv.innerHTML = `<p class="loading-text" style='color:red;'>Lỗi truy vấn.</p>`; return;
         }

        currentMailListener = q.onSnapshot((querySnapshot) => {
            console.log(`${folder} snapshot received, size:`, querySnapshot.size);
            // *** PHẢI LẤY LẠI mailListDiv MỖI LẦN SNAPSHOT VỀ ***
            const currentMailListDiv = getElement('mail-list');
            if (!currentMailListDiv) {
                 console.warn("mail-list element no longer exists when snapshot arrived.");
                 if(currentMailListener) { currentMailListener(); currentMailListener = null; }
                 return;
            }

            if (querySnapshot.empty) { currentMailListDiv.innerHTML = `<p class="loading-text">Không có tin nhắn nào.</p>`; return; }
            currentMailListDiv.innerHTML = "";
            querySnapshot.forEach((doc) => { /* ... Code tạo msgElement như cũ ... */
                const msg = doc.data();
                if (!msg || typeof msg !== 'object' || !msg.subject || !msg.body || (!msg.from && folder === 'inbox') || (!msg.to && folder === 'sent')) { console.warn("Invalid message data:", msg); return; }
                const msgElement = document.createElement('div'); msgElement.className = 'mail-item';
                const sentTime = formatTimestamp(msg.timestamp);
                const participant = (folder === 'inbox') ? msg.from : `Đến: ${msg.to}`;
                msgElement.innerHTML = `<div class="mail-item-sender">${participant || 'N/A'}</div> <div class="mail-item-subject">${msg.subject}</div> <div class="mail-item-preview">${msg.body.substring(0, 40)}...</div> <small>${sentTime}</small>`;
                msgElement.onclick = () => { showMailDetail(msg); document.querySelectorAll('#mail-list .mail-item').forEach(item => item.classList.remove('active')); msgElement.classList.add('active'); };
                currentMailListDiv.appendChild(msgElement);
             });
        }, (error) => { /* ... Xử lý lỗi onSnapshot như cũ ... */
            console.error(`Lỗi nhận tin (${folder}): `, error);
             const currentMailListDiv = getElement('mail-list'); // Lấy lại
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
    initializeMailElements(); // Gọi hàm này để lấy và gắn sự kiện cho các nút folder mail

     // --- Logic Modal Soạn thư (Giữ nguyên) ---
    if (mailComposeModal && mailComposeCloseBtn) { // Kiểm tra element tồn tại
        if (mailComposeCloseBtn) mailComposeCloseBtn.onclick = () => { mailComposeModal.style.display = 'none'; };
        window.onclick = (event) => { if (event.target == mailComposeModal) mailComposeModal.style.display = "none"; };
    } else { console.warn("Compose modal elements not found."); }


    // --- Logic Gửi Mail (Giữ nguyên) ---
    if (sendBtn && mailToInput && mailSubjectInput && mailBodyInput && mailStatus) { // Kiểm tra element
        sendBtn.onclick = async () => { /* ... Code gửi mail như cũ ... */
            const to = mailToInput.value.trim(); const subject = mailSubjectInput.value.trim(); const body = mailBodyInput.value.trim();
            if (!to || !subject || !body) { mailStatus.textContent = "Vui lòng nhập đủ thông tin!"; mailStatus.style.color = "red"; return; }
            if (!/\S+@\S+\.\S+/.test(to)) { mailStatus.textContent = "Email nhận không hợp lệ!"; mailStatus.style.color = "red"; return; }
            sendBtn.textContent = "Đang gửi..."; sendBtn.disabled = true; mailStatus.textContent = "";
            try { await db.collection("messages").add({ to: to, from: userEmail, subject: subject, body: body, timestamp: firebase.firestore.FieldValue.serverTimestamp() }); mailStatus.textContent = "Gửi thành công!"; mailStatus.style.color = "green"; setTimeout(() => { mailToInput.value = ""; mailSubjectInput.value = ""; mailBodyInput.value = ""; if(mailComposeModal) mailComposeModal.style.display = 'none'; if(mailStatus) mailStatus.textContent = ""; }, 1500); }
            catch (e) { console.error("Lỗi gửi:", e); mailStatus.textContent = "Gửi lỗi!"; mailStatus.style.color = "red"; }
            finally { setTimeout(() => { if (sendBtn) { sendBtn.textContent = "Gửi"; sendBtn.disabled = false; } }, 1500); }
         };
    } else { console.warn("Compose mail button or inputs not found."); }


    // --- Kích hoạt tải mail ban đầu nếu tab Mail active ---
    setTimeout(() => {
        const currentActiveTab = document.querySelector('.tab.active');
        if (currentActiveTab && currentActiveTab.dataset.tab === 'mail') {
            if (!currentMailListener) { loadMessages('inbox'); }
        }
    }, 250); // Tăng độ trễ hơn nữa


    // ===============================================
    // == KẾT THÚC CODE MỚI CHO APP MAIL ==
    // ===============================================


    // ===============================================
    // == CODE CŨ: ĐỒNG BỘ DỮ LIỆU AI REAL-TIME (Giữ nguyên) ==
    // ===============================================
    const systemDataRef = db.collection('system_data');
    // Chỉ lắng nghe nếu ít nhất một element AI data tồn tại
    if (document.getElementById('live-btc-price-value') || document.getElementById('live-sentiment-value')) {
        aiDataUnsubscribe = systemDataRef.onSnapshot((querySnapshot) => { // Gán hàm hủy vào biến
            console.log("AI data update received...");
            querySnapshot.forEach((doc) => { /* ... Code cập nhật UI AI data như cũ ... */
                const data = doc.data(); const genericLastUpdatedText = data.last_updated ? `Cập nhật: ${formatTimestamp(data.last_updated)}` : "Đang tải..."; try {
                const btcPriceEl = getElement('live-btc-price-value', false); const lastUpdatedElQ = getElement('live-last-updated', false); const quantSummaryElQ = getElement('quant-summary', false);
                const sentimentEl = getElement('live-sentiment-value', false); const sentimentSourceElS = getElement('live-sentiment-source', false); const sentimentSummaryElS = getElement('sentiment-summary', false); const sentimentFillElS = querySelector('#sentiment .fill', false); const sentimentScoreTextElS = getElement('sentiment-score-text', false);
                const recommendationEl = getElement('live-recommendation-value', false); const recommendationReasonElA = getElement('live-recommendation-reason', false);
                const riskListElR = getElement('risk-list', false);
                switch (doc.id) {
                     case 'quant_ai': if (btcPriceEl && data.btc_price !== undefined) btcPriceEl.textContent = `$${data.btc_price.toLocaleString('en-US')}`; if (lastUpdatedElQ) lastUpdatedElQ.textContent = `Quant: ${data.last_updated ? formatTimestamp(data.last_updated) : 'N/A'}`; if (quantSummaryElQ) quantSummaryElQ.textContent = `AI nhận định: ${data.trend || 'N/A'}, RSI=${data.rsi || 'N/A'}`; break;
                     case 'sentiment_ai': if (sentimentEl && data.score !== undefined) sentimentEl.textContent = `${data.score}%`; if (sentimentSourceElS && data.source) sentimentSourceElS.textContent = `Nguồn: ${data.source}`; if (sentimentSummaryElS) sentimentSummaryElS.textContent = `Phân tích tâm lý từ ${data.source || 'N/A'}. Điểm: ${data.score || 'N/A'}/100`; if(sentimentFillElS) sentimentFillElS.style.width = `${data.score || 0}%`; if(sentimentScoreTextElS) sentimentScoreTextElS.textContent = `${data.score || 0}/100`; break;
                     case 'advisor_ai': if (recommendationEl && data.recommendation) recommendationEl.textContent = data.recommendation; if (recommendationReasonElA && data.reasoning) recommendationReasonElA.textContent = data.reasoning; break;
                     case 'risk_ai': if (riskListElR && data.volatility !== undefined && data.max_drawdown !== undefined) { riskListElR.innerHTML = `<li>Độ biến động: <b>${data.volatility}%</b></li><li>Max Drawdown: <b>${data.max_drawdown}%</b></li><li>Vốn tối đa: <b>${data.max_leverage || 'N/A'}</b></li><li><small>Risk AI: ${data.last_updated ? formatTimestamp(data.last_updated) : 'N/A'}</small></li>`; } else if (riskListElR) { riskListElR.innerHTML = '<li>Đang tải...</li>'; } break;
                 } } catch (e) { console.error(`Error UI update for ${doc.id}:`, e); }
             });
        }, (error) => { console.error("Lỗi lắng nghe AI data: ", error); const btcPriceEl = getElement('live-btc-price-value', false); if (btcPriceEl) btcPriceEl.textContent = "Lỗi"; });
    } else { console.warn("Không tìm thấy element AI data, bỏ qua listener."); }

    console.log("Dashboard initialization complete.");

} // --- END of runDashboard() ---