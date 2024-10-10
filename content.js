// chrome.storage.sync.get(['featureEnabled'], function (result) {
//     if (result.featureEnabled) {
//         // 功能開啟時執行的代碼
//         domjudgeView();
//     }
// });
domjudgeView();

let contestStartTime = -1;
// let contestStartTime = 1726755078;
let blueLine;
let submissionResult;
let contestProblems, contestProblemName, gymRound;
let teamname, rank, penalty, score;
let problemStatus = {};
let timerInterval;
let submitForm;
let contestLength = 18000;

function getCurrentURL () {
    return window.location.href;
}

function parseLanguage(language){
    if(language.startsWith('C++')){
        return "CPP";
    }
    if(language.startsWith('Py')){
        return "PY3";
    }
    return language;
}

function parseVerdict(verdict){
    if(verdict == "OK") return "CORRECT";
    if(verdict == "WRONG_ANSWER")   return "WRONG-ANSWER";
    if(verdict == "TIME_LIMIT_EXCEEDED") return "TIMELIMIT";
    if(verdict == "RUNTIME_ERROR") return "RUN-ERROR";
    if(verdict == "MEMORY_LIMIT_EXCEEDED") return "RUN-ERROR";
    if(verdict == "COMPILATION_ERROR")  return "COMPILER-ERROR";
    if(verdict == "TESTING")  return "PENDING";
    return "PENDING";
}

function parseSubmission(result){
    submissionResult = [];
    for(let submission of result){        
        if(contestStartTime <= submission.creationTimeSeconds && submission.creationTimeSeconds - contestStartTime < contestLength){
            const date = new Date(submission.creationTimeSeconds * 1000);
            submissionResult.push({
                index: submission.problem.index,
                verdict: parseVerdict(submission.verdict),
                time: date.getHours().toString().padStart(2, '0')+":"+date.getMinutes().toString().padStart(2, '0'),
                submitMinute: Math.floor(submission.relativeTimeSeconds/60),
                language: parseLanguage(submission.programmingLanguage)
            });
        }
    }
    const reversedSubmissionResult = submissionResult.slice().reverse();
    for(let submission of reversedSubmissionResult){
        if(submission.index in problemStatus){
            if(submission.verdict == "CORRECT"){
                if(problemStatus[submission.index].passtime == -1)
                    problemStatus[submission.index].passtime = submission.submitMinute;
            }
            else if(submission.verdict == "PENDING"){
                problemStatus[submission.index].pendingNumber = problemStatus[submission.index].pendingNumber+1;
                if(problemStatus[submission.index].pending == -1)
                    problemStatus[submission.index].pending = submission.submitMinute;
            }
            else{
                problemStatus[submission.index].rejected = problemStatus[submission.index].rejected + (submission.verdict == "COMPILER-ERROR" ? 0 : 1);
            }
        }
        else{
            let newStatus;
            if(submission.verdict == "PENDING"){
                newStatus = {
                    rejected: 0,
                    passtime: -1,
                    pending: submission.submitMinute,
                    pendingNumber: 1
                }
            }
            else if(submission.verdict != "CORRECT"){
                newStatus = {
                    rejected: submission.verdict == "COMPILER-ERROR" ? 0 : 1,
                    passtime: -1,
                    pending: -1,
                    pendingNumber: 0
                }
            }
            else{
                newStatus = {
                    rejected: 0,
                    passtime: submission.submitMinute,
                    pending: -1,
                    pendingNumber: 0
                }
            }
            problemStatus[submission.index] = newStatus;
        }
    }
}

async function getApiData () {
    domjudgeView();
    gymRound = getCurrentURL().split('/')[4];
    // console.log(gymRound);

    let links = document.querySelectorAll('a'), username;
    // 取得 username
    for (let link of links) {
        if (link.href.includes('/profile/')) {
            username = link.href.split('/')[4];
            break; 
        }
    }
    
    const SubmissionApiURL = 'https://codeforces.com/api/contest.status?contestId=' + gymRound + '&handle=' + username;
    // console.log(SubmissionApiURL);

    await fetch(SubmissionApiURL)
    .then(response => response.json())  // 將回應轉為 JSON 格式
    .then(data => {
        if (data.result && data.result.length > 0) {
            if("startTimeSeconds" in data.result[0].author)
                contestStartTime = data.result[0].author.startTimeSeconds;
            parseSubmission(data.result);
            // return data.result[0].creationTimeSeconds;
        } else {
            console.log("No result found in Submission API response");
        }
    })
    .then(() => drawHeader())
    .catch(error => {
        console.error("Error fetching API:", error);
    });
    
    const ContestApiURL = 'https://codeforces.com/api/contest.standings?contestId=' + gymRound + '&from=1&showUnofficial=true';
    // console.log(ContestApiURL);
    
    await fetch(ContestApiURL)
    .then(response => response.json())  // 將回應轉為 JSON 格式
    .then(data => {
        if (data.result) {
            contestLength = data.result.contest.durationSeconds;

            contestProblems = [];
            for(let problem of data.result.problems){
                contestProblems.push(problem.index);
            }
            
            contestProblemName = [];
            for(let problem of data.result.problems){
                contestProblemName.push(problem.index + " - " + problem.name);
            }
            
            for(let team of data.result.rows){
                if(team.party.members.some(item => item.handle === username)){
                    penalty = team.penalty;
                    rank = team.rank;
                    score = team.points;
                    if("teamName" in team.party)
                        teamname = team.party.teamName;
                    else
                    teamname = username;
                    break;
                }
            }
        } else {
            console.log("No result found in Contest API response");
        }
    })
    .then(() => drawTimeLine())
    .then(() => updateTimeLine())
    .then(() => drawTeamsSummary())
    .then(() => drawSubmission())
    .then(() => addSubmitPage())
    .then(() => submitButtomJquery());
    // .catch(error => {
    //     console.error("Error fetching API:", error);
    // });

    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimeLine(){
    if(contestStartTime == -1)  return;
    // console.log((Date.now() / 1000 - contestStartTime), contestLength);
    contestDuringPrecentage = (Date.now() / 1000 - contestStartTime) / contestLength;
    // contestDuringPrecentage = Math.random();
    if(contestDuringPrecentage > 1) {
        return;
    }
    let pageWidth = window.innerWidth;
    let blueLineWidth = contestDuringPrecentage * pageWidth;
    blueLine.style.width = blueLineWidth + 'px'; // 設定寬度
}

function addFontAwesome(){
    // 獲取頁面中的 <header> 元素
    let header = document.querySelector('head');

    // 創建一個新的 <script> 元素
    let scriptElement = document.createElement('script');

    // 設置 <script> 標籤的屬性
    scriptElement.src = "all.min.js";
    scriptElement.type = "text/javascript";

    // 將 <script> 元素添加到 <header> 中
    if (header) {
        header.appendChild(scriptElement);
    }
}
function drawTimeLine(){
    if(contestStartTime == -1)  return;
    contestDuringPrecentage = (Date.now() / 1000 - contestStartTime) / contestLength;
    // contestDuringPrecentage = 0.5;
    if(contestDuringPrecentage > 1) {
        return;
    }
    let pageWidth = window.innerWidth;
    let blueLineWidth = contestDuringPrecentage * pageWidth;
    
    blueLine = document.createElement('div');
    blueLine.style.position = 'absolute';
    blueLine.style.bottom = '0';
    blueLine.style.left = '0';
    blueLine.style.height = '5.5px'; // 可以調整高度
    blueLine.style.backgroundColor = '#0079ff';
    blueLine.style.zIndex = '9999'; // 保證藍線在最上層
    blueLine.style.width = blueLineWidth + 'px'; // 設定寬度
    document.querySelector('nav').appendChild(blueLine);

}

function drawHeader(){
    document.getElementById('body').style.margin = "0";

    // 選擇所有的 <a> 元素
    let links = document.querySelectorAll('a');
    let LogoutLink;

    // 遍歷每個 <a>，檢查其 innerHTML 是否包含 "Logout"
    links.forEach(link => {
        if (link.innerHTML.includes('Logout')) {
            // console.log(link); // 找到的 <a> 元素會被輸出到控制台
            LogoutLink = link;
        }
    });

    document.getElementById('header').remove();
    document.querySelector('.menu-list-container').remove();
    document.querySelector('.menu-box').remove();

    let baseUrl = getCurrentURL().split('/').slice(0, 5).join('/');

    let navElement = document.createElement('nav');
    navElement.classList.add('navbar','navbar-expand-md','navbar-dark','bg-dark','fixed-top');

    let navHTML = "";

    navHTML = `<a class="navbar-brand hidden-sm-down" href="${baseUrl}/submit">DOMjudge</a>`;

    navHTML += '<div class="collapse navbar-collapse" id="menuDefault">';
    navHTML += '<ul class="navbar-nav mr-auto">';
    navHTML += `<li class="nav-item active"><a class="nav-link" href="${baseUrl}/submit"><i class="fas fa-home"></i> Home </a></li>`;
    navHTML += `<li class="nav-item"><a class="nav-link" href="${baseUrl}"><i class="fas fa-book-open"></i> Problemset </a></li>`;
    navHTML += `<li class="nav-item"><a class="nav-link" href="${baseUrl}/standings"><i class="fas fa-list-ol"></i> Scoreboard </a></li>`;

    navHTML += '</ul>';
    navHTML += '<div id="submitbut"><a id="submitLink" class="nav-link justify-content-center" data-ajax-modal="" data-ajax-modal-after="initSubmitModal" href="#"><span class="btn btn-success btn-sm"><i class="fas fa-cloud-upload-alt"></i> Submit</span></a></div>';
    navHTML += `<a class="btn btn-info btn-sm justify-content-center" href="${LogoutLink}" onclick="return confirmLogout();"><i class="fas fa-sign-out-alt"></i> Logout</a>`;
    navHTML += `<div class="navbar-text" style="white-space:nowrap;"><span style="padding-left: 10px;"><i class="fas fa-clock loading-indicator"></i></span><span id="timeleft"> contest over</span></div>`;
    navHTML += '</div>';

    navElement.innerHTML = navHTML;

    let bodyDiv = document.getElementById('body');
    bodyDiv.insertBefore(navElement, bodyDiv.firstChild);
}

function updateTimer(){
    if(Math.floor(Date.now()/1000) - contestStartTime > contestLength){
        document.getElementById("timeleft").innerHTML = " contest over";
        clearInterval(timerInterval); // 倒數結束時停止計時
    }
    else{
        let leftSecond = contestLength - (Math.floor(Date.now()/1000) - contestStartTime);
        let minutes = (Math.floor((leftSecond%3600)/60));
        let seconds = leftSecond%60;
        let displayMinutes = minutes < 10 ? '0' + minutes : minutes;
        let displaySeconds = seconds < 10 ? '0' + seconds : seconds;
        if(leftSecond > 3600)
            document.getElementById("timeleft").innerHTML = " " + Math.floor(leftSecond/3600).toString() + ":" + displayMinutes + ":" + displaySeconds;
        else
            document.getElementById("timeleft").innerHTML = " " + displayMinutes + ":" + displaySeconds;
    }
}

function drawTeamsSummary(){
    // console.log(contestProblems);

    let tableHTML = '<table class="summary-table center">';
    
    // Table Header
    tableHTML += '<colgroup><col id="scorerank"><col id="scoreteamname"></colgroup>';
    tableHTML += '<colgroup><col id="scoresolv"><col id="scoretotal"></colgroup>';
    tableHTML += '<colgroup>';
    for(let i = 0; i < contestProblems.length; i++){
        tableHTML += '<col class="scoreprob"';
    }
    tableHTML += '</colgroup>';
    tableHTML += '<thead><tr class="summary-table-header">';
    tableHTML += '<th title="rank" scope="col">rank</th>';
    tableHTML += '<th title="team name" scope="col" colspan="3">team</th>';
    tableHTML += '<th title="# solved / penalty time" colspan="2" scope="col">score</th>';
    // tableHTML += '<th style="text-align: center;">score</th>';
    contestProblems.forEach(problemIndex => {
        const linkURL = `https://codeforces.com/gym/${gymRound}/problem/${problemIndex.toString()}`;
        tableHTML += `<th title="" scope="col"><a href="${linkURL}" target="_blank"><span class="badge problem-badge" style="min-width: 28px; border: 1px solid"><span style="color: #000000;">${problemIndex}</span></span></a></th>`;
    });
    tableHTML += '</tr></thead><tbody>';
    
    tableHTML += '<tr class="sortorderswitch">';
    tableHTML += `<td class="scorepl">${rank}</td>`;
    tableHTML += `<td class="scoreaf"> </td>`;
    tableHTML += `<td class="scoreaf"> </td>`;
    tableHTML += `<td class="scoretn">${teamname}</td>`;
    // tableHTML += `<td class="score-penalty-table"><div>${score}</div><div>${penalty}</div></td>`;
    tableHTML += `<td class="scorenc">${score}</td>`;
    tableHTML += `<td class="scorett">${penalty}</td>`;
    
    contestProblems.forEach(problemIndex => {
        if(!(problemIndex in problemStatus))
            tableHTML += `<td class="score_cell"></td>`;
        else if(problemStatus[problemIndex].passtime != -1){
            // console.log(problemIndex, problemStatus[problemIndex].passtime, problemStatus[problemIndex].pending, problemStatus[problemIndex].pendingNumber);
            if(problemStatus[problemIndex].passtime > problemStatus[problemIndex].pending && problemStatus[problemIndex].pendingNumber != 0){
                const tryTime = problemStatus[problemIndex].rejected;
                const tryString = tryTime.toString() + " + " + (problemStatus[problemIndex].pendingNumber).toString() + " tries";
                tableHTML += `<td class="score_cell"><a><div style="background:#6666FF">&nbsp;<span>${tryString}</span></div></a></td>`;
            }
            else{
                const tryTime = problemStatus[problemIndex].rejected+1;
                const tryString = tryTime.toString() + (tryTime > 1 ? " tries" : " try");
                tableHTML += `<td class="score_cell"><a><div style="background:#60e760">${problemStatus[problemIndex].passtime}<span>${tryString}</span></div></a></td>`;
            }
        }
        else if(problemStatus[problemIndex].pendingNumber != 0){
            const tryTime = problemStatus[problemIndex].rejected;
            const tryString = tryTime.toString() + " + " + (problemStatus[problemIndex].pendingNumber).toString() + " tries";
            tableHTML += `<td class="score_cell"><a><div style="background:#6666FF">&nbsp;<span>${tryString}</span></div></a></td>`;
        }
        else{
            const tryTime = problemStatus[problemIndex].rejected;
            const tryString = tryTime.toString() + (tryTime > 1 ? " tries" : " try");
            tableHTML += `<td class="score_cell"><a><div style="background:#e87272">&nbsp;<span>${tryString}</span></div></a></td>`;
        }
        
    });
    tableHTML += '</tr>';
    
    tableHTML += '</tbody></table>';

    submitForm = document.getElementById('pageContent').getElementsByTagName('form')[0];
    
    document.getElementById('pageContent').innerHTML = tableHTML;
    
}
function drawSubmission(){
    let tableHTML = '<div class="row><div class="col">';

    tableHTML += '<h1 class="teamoverview">Submissions</h1>';
    tableHTML += '<table class="data-table table table-hover table-striped table-sm submissions-table">'
    
    tableHTML += '<thead class="thead-light"><tr><th scope="col">time</th><th scope="col">problem</th><th scope="col">lang</th><th scope="col">result</th></tr></thead>';
    
    tableHTML += '<tbody>';

    submissionResult.forEach(Submission =>{
        tableHTML += '<tr class>';
        tableHTML += `<td>${Submission.time}</td>`;
        tableHTML += `<td class="probid"><a><span class="badge problem-badge" style="min-width: 28px;border: 1px solid #7293a8";><span>${Submission.index}</span></span><a></td>`;
        tableHTML += `<td class="langid"><a>${Submission.language}</a></td>`;
        if(Submission.verdict == "CORRECT")
            tableHTML += `<td class="sol sol_correct"><a>${Submission.verdict}</a></td>`;
        else if(Submission.verdict == "PENDING")
            tableHTML += `<td class="sol sol_queued"><a>${Submission.verdict}</a></td>`;
        else
            tableHTML += `<td class="sol sol_incorrect"><a>${Submission.verdict}</a></td>`;
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table>';
    tableHTML += '</div></div>';

    document.getElementById('pageContent').innerHTML += tableHTML;
    document.getElementById('sidebar').innerHTML = "";
}

addFontAwesome();
getApiData();

function domjudgeView() {
    // 遍歷所有的文本節點
    let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node, nextNode;

    while (node = walker.nextNode()) {
        // 檢查節點是否包含 'on test'
        let textContent = node.nodeValue;
        let index = textContent.indexOf(' ON TEST');

        if (index !== -1) {
            // 刪除 'on test' 及其後面的所有內容
            node.nodeValue = textContent.substring(0, index);
            nextNode = walker.nextNode();
            nextNode.nodeValue = "";
        }
        else{
            let pretestIndex = textContent.indexOf(' ON PRETEST');
            if (pretestIndex !== -1) {
            // 刪除 'on pretest' 及其後面的所有內容
                node.nodeValue = textContent.substring(0, pretestIndex);
                nextNode = walker.nextNode();
                nextNode.nodeValue = "";
            }
        }
    }
}


// 監聽 DOM 的變化以處理動態更新的內容
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        // 針對新增的節點，重新執行移除操作
        if (mutation.addedNodes.length) {
            // chrome.storage.sync.get(['featureEnabled'], function (result) {
            //     if (result.featureEnabled) {
            //         domjudgeView();
            //         updateTimeLine();
            //     }
            // });
            domjudgeView();
            updateTimeLine();
        }
    });
});

// 配置監聽器參數
const observerConfig = {
    childList: true,  // 監聽子節點變動
    subtree: true,    // 監聽整個子樹
    characterData: true  // 監聽文字內容變動
};

// 啟動監聽器
observer.observe(document.body, observerConfig);

function humanReadableTimeDiff(seconds) {
    var intervals = [
        ['years', 365 * 24 * 60 * 60],
        ['months', 30 * 24 * 60 * 60],
        ['days', 24 * 60 * 60],
        ['hours', 60 * 60],
        ['minutes', 60],
    ];
    for (let [name, length] of intervals) {
        if (seconds / length >= 2) {
            return Math.floor(seconds/length) + ' ' + name;
        }
    }
    return Math.floor(seconds) + ' seconds';
}

function humanReadableBytes(bytes) {
    var sizes = [
      ['GB', 1024*1024*1024],
      ['MB', 1024*1024],
      ['KB', 1024],
    ];
    for (let [name, length] of sizes) {
        if (bytes / length >= 2) {
            return Math.floor(bytes/length) + name;
        }
    }
    return Math.floor(bytes) + 'B';
}

function addSubmitPage(){
    // 創建模態框的 HTML

    let submitTable = submitForm.querySelector('tbody');
    let rows = submitTable.querySelectorAll('tr');
    
    submitTable.insertBefore(rows[4], rows[0]);
    submitTable.removeChild(rows[3]);
    
    submitForm.querySelector('.field-name').innerHTML = "Source files";
    submitForm.querySelector('.programTypeNotice').remove();
    submitForm.querySelector('.outputOnlyProgramTypeIdNotice').remove();
    submitForm.querySelector(".error__submittedProblemIndex").remove();

    let submitButInput = submitTable.querySelector(".submit");
    let buttonElement = document.createElement("button");
    buttonElement.id = submitButInput.id;
    buttonElement.type = submitButInput.type;
    buttonElement.className = submitButInput.className;
    buttonElement.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> Submit `;
    // submitTable.replaceChild(buttonElement, submitButInput);

    buttonElement.classList.add('btn');
    buttonElement.classList.add('btn-success');


    const allowedLanguage = ["43", "89", "87", "31"];
    const languageName = ["C", "CPP", "JAVA", "PYTHON3"];

    const selectElement = submitForm.querySelector('select[name="programTypeId"]');
    Array.from(selectElement.options).forEach(option => {
        if (!allowedLanguage.includes(option.value)) {
            option.remove();
        }
        else{
            for(let i = 0; i < allowedLanguage.length; i++){
                if(allowedLanguage[i] == option.value){
                    option.innerHTML = languageName[i];
                    option.removeAttribute('selected');
                    break;
                }
            }
        }
    });

    const noLanguageOption = document.createElement('option');
    noLanguageOption.value = "0";
    noLanguageOption.text = "Select a language";
    noLanguageOption
    selectElement.insertBefore(noLanguageOption, selectElement.firstChild);

    // console.log(submitForm.outerHTML);

    // <span class="close">&times;</span>

    submitForm.querySelector('select[name="submittedProblemIndex"]').querySelector('option[value=""]').remove();
    let submit_problem_option = submitForm.querySelector('select[name="submittedProblemIndex"]').innerHTML;
    let csrf_token_input = submitForm.querySelector('input[name="csrf_token"]').outerHTML;
    // console.log(submit_problem_option);
    
    const modalHTML = `<div id="myModal" class="modal fade show" tabindex="-1" role="dialog" aria-modal="true" style="display: none;">
    <div class="modal-dialog modal-lg" role="document"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Submit</h5><button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button></div>
<form class="submit-form" name="csrf_token" method="post" action="/team/submit" enctype="multipart/form-data">`
    + csrf_token_input +
    `<input type="hidden" name="ftaa" value="">
    <input type="hidden" name="bfaa" value="">
    <input type="hidden" name="action" value="submitSolutionFormSubmitted">
    <div class="modal-body">
    <div class="form-group"><label for="submit_problem_code" class="required">Source files</label><div class="custom-file"><input type="file" id="submit_problem_code" name="sourceFile" required="required" class="custom-file-input custom-file-input"><label class="custom-file-label text-truncate text-muted" for="submit_problem_code">No file selected</label></div></div>
    <div class="alert alert-warning" id="files_not_modified" style="display:none;"></div>
    <div class="form-group"><label class="required" for="submit_problem_problem">Problem</label><select id="submit_problem_problem" name="submittedProblemIndex" required="required" class="form-control custom-select form-control"><option value="" selected="selected">Select a problem</option>` + submit_problem_option + `</select></div>
    <div class="form-group"><label class="required" for="submit_problem_language">Language</label><select id="submit_problem_language" name="programTypeId" required="required" class="form-control custom-select form-control"><option value="" selected="selected">Select a language</option><option value="43">C</option><option value="89">C++</option><option value="87">Java</option><option value="31">Python 3</option></select></div></div>
    <div class="modal-footer"><button id="cancelBtn" type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button><button type="submit" class="btn-success btn"><i class="fas fa-cloud-upload-alt"></i> Submit </button></div><input type="hidden" name="_tta" value="396"></form></div></div>
    </div>`;
    
    // 插入模態框到頁面中
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    $(function () {
        $('body').on('change', '.custom-file-input', function () {
            var files = this.files;
            var fileNames = [];
            for (var i = 0; i < files.length; i++) {
                fileNames.push(files.item(i).name);
            }
            $(this).next('.custom-file-label').html(fileNames.join(", "));
            $(this).next('.custom-file-label').removeClass('text-muted');
        });
    });

    const fileInput = document.getElementById('submit_problem_code');
    fileInput.addEventListener('change', (event) => {

        const five_minutes_in_ms = 5 * 60 * 1000;
        const now = Date.now();
        const filesNotModified = document.getElementById('files_not_modified');
        filesNotModified.style.display = 'none';

        var atLeastOneFileRecent = false;
        var fileInfoHtml = '';
        const files = event.target.files;
        for (let file of files) {
            const date = new Date(file.lastModified);
            const ago = humanReadableTimeDiff((now - date)/1000) + ' ago';
            if (date > now - five_minutes_in_ms) {
                atLeastOneFileRecent = true;
            }
            size = humanReadableBytes(file.size);
            fileInfoHtml += `<li><span class="filename">${file.name}</span>, ${size}, last modified ${ago}</li>`;
        }
        if (!atLeastOneFileRecent) {
            filesNotModified.style.display = 'block';
            filesNotModified.innerHTML =
                'None of the selected files has been recently modified:' +
                '<ul>' + fileInfoHtml + '</ul>';
        }
    });

    const modal_backdrop_html = `<div class="modal-backdrop fade show" style="display:none;"></div>`;
    document.body.insertAdjacentHTML('beforeend', modal_backdrop_html);

    // 把 input 按鈕換成 button
    // submitButInput = document.getElementById("singlePageSubmitButton");
    // submitButInput.parentNode.insertBefore(buttonElement, submitButInput);
    // submitButInput.remove();

    // 獲取模態框和觸發連結
    const modal = document.getElementById('myModal');
    const openModal = document.getElementById('submitbut');
    const closeModal = document.querySelector('.close');
    const cancelModal = document.getElementById('cancelBtn');
    const modal_backdrop = document.querySelector('.modal-backdrop');
    const filesNotModified = document.getElementById('files_not_modified');

    // 當用戶點擊連結時，顯示模態框
    openModal.addEventListener('click', function(event) {
        event.preventDefault(); // 防止連結跳轉
        modal.style.display = 'block';
        modal_backdrop.style.display = 'block';
    });

    // 當用戶點擊關閉按鈕時，隱藏模態框
    closeModal.addEventListener('click', function() {
        modal.style.display = 'none';
        modal_backdrop.style.display = 'none';
        filesNotModified.style.display = 'none';
    });

    // 當用戶點擊模態框外部時，隱藏模態框
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
            modal_backdrop.style.display = 'none';
            filesNotModified.style.display = 'none';
        }
    });

    cancelModal.addEventListener('click', function() {
        modal.style.display = 'none';
        modal_backdrop.style.display = 'none';
        filesNotModified.style.display = 'none';
    });
}


function getMainExtension(ext) {
    switch (ext) {
        case 'c':
            return '43';
        case 'cpp':
            return '89';
        case 'cc':
            return '89';
        case 'cxx':
            return '89';
        case 'c++':
            return '89';
        case 'java':
            return '87';
        case 'py':
            return '31';
        default:
            return '';
    }
}


function submitButtomJquery(){

    $(document).ready(function () {
        {
        }
        var processFile = function () {
            var filename = $('#submit_problem_code').val();
            if (filename !== '' && filename !== undefined) {
                filename = filename.replace(/^.*[\\\/]/, '');
                var parts = filename.split('.').reverse();
                if (parts.length < 2) return;
                var lcParts = [parts[0].toLowerCase(), parts[1].toLowerCase()];
        
                // language ID
        
                var language = document.getElementById('submit_problem_language');
                // the "autodetect" option has empty value
                if (language.value !== '') return;
        
                var langid = getMainExtension(lcParts[0]);
                for (i = 0; i < language.length; i++) {
                    if (language.options[i].value === langid) {
                        language.selectedIndex = i;
                    }
                }
        
                // Problem ID
        
                var problem = document.getElementById('submit_problem_problem');
                // the "autodetect" option has empty value
                if (problem.value !== '') {
                    return;
                }
        
                for (var i = 0; i < problem.length; i++) {
                    if (problem.options[i].text.split(/ - /)[0].toLowerCase() === lcParts[1]) {
                        problem.selectedIndex = i;
                    }
                }
            }
        };
        var $body = $('body');
        $body.on('change', '#submit_problem_code', processFile);
    });
    
    const form = document.querySelector('.submit-form');
    
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        
        const formData = new FormData(document.querySelector('.submit-form'));
    
        // for (const [key, value] of formData.entries()) {
        //     console.log(key, value);
        // }

        var langelt = document.getElementById("submit_problem_language");
        var language = langelt.options[langelt.selectedIndex].value;
        var languagetxt = langelt.options[langelt.selectedIndex].text;
        var fileelt = document.getElementById("submit_problem_code");
        var filenames = fileelt.files;
        var filename = filenames[0].name;
        var probelt = document.getElementById("submit_problem_problem");
        var problem = probelt.options[probelt.selectedIndex].value;
        var problemtxt = probelt.options[probelt.selectedIndex].text;

        var error = false;
        if (language === "") {
            langelt.focus();
            langelt.className = langelt.className + " errorfield";
            error = true;
        }
        if (problem === "") {
            probelt.focus();
            probelt.className = probelt.className + " errorfield";
            error = true;
        }
        if (filename === "") {
            error = true;
        }
        if (error) return false;

        var auxfileno = 0;
        // start at one; skip maincode file field
        for (var i = 1; i < filenames.length; i++) {
            if (filenames[i].value !== "") {
                auxfileno++;
            }
        }
        var extrafiles = '';
        if (auxfileno > 0) {
            extrafiles = "Additional source files: " + auxfileno + '\n';
        }
        var question =
            'Main source file: ' + filename + '\n' +
            extrafiles + '\n' +
            'Problem: ' + problemtxt + '\n' +
            'Language: ' + languagetxt + '\n' +
            '\nMake submission?';
        if(confirm(question)){
            fetch(getCurrentURL().split('/').slice(0, 5).join('/')+'/submit?csrf_token='+formData.get('csrf_token'), {
                method: form.method,
                body: formData,
            })
            .then(response => {
                if (response.ok) {
                    location.reload();

                } else {
                    console.error('submit fail');
                }
            });
        }
        // .catch(error => {
        //     console.error('error: ', error);
        // });
    });
}