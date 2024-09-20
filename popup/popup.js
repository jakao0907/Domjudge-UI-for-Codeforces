document.addEventListener('DOMContentLoaded', function () {
    const toggle = document.getElementById('featureToggle');

    // 從 storage 中加載狀態
    chrome.storage.sync.get('featureEnabled', function (result) {
        toggle.checked = result.featureEnabled || false;
    });

    // 當開關狀態改變時更新 storage
    toggle.addEventListener('change', function () {
        chrome.storage.sync.set({ featureEnabled: toggle.checked }, function () {
            console.log('Feature enabled:', toggle.checked);
        });
    });
});
