/* ================= auth.js ================= */
/* 登录密码系统：4位数字密码 */

var AUTH_KEY = 'app_password';
var AUTH_DEVICE = 'device_token';
var AUTH_EXPIRE_DAYS = 7;

/* ---------- 检查是否需要登录 ---------- */

function checkAuth() {
    dbGetAll('systemConfig', function(configs) {
        var password = null;
        var deviceToken = null;

        for (var i = 0; i < configs.length; i++) {
            if (configs[i].key === AUTH_KEY) password = configs[i].value;
            if (configs[i].key === AUTH_DEVICE) deviceToken = configs[i].value;
        }

        if (!password) {
            showSetPasswordScreen();
            return;
        }

        if (deviceToken) {
            try {
                var data = JSON.parse(deviceToken);
                var saved = new Date(data.time).getTime();
                var now = new Date().getTime();
                var diffDays = (now - saved) / (1000 * 60 * 60 * 24);
                if (diffDays < AUTH_EXPIRE_DAYS) {
                    return;
                }
            } catch(e) {}
        }

        showLoginScreen();
    });
}
/* ---------- 首次设置密码界面 ---------- */

function showSetPasswordScreen() {
    var overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;z-index:999;display:flex;align-items:center;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText = 'text-align:center;padding:30px;width:80%;max-width:320px;';
    box.innerHTML = '<h2 style="margin-bottom:8px;color:#1a73e8;">沙场记账</h2>'
        + '<p style="color:#888;margin-bottom:30px;font-size:14px;">首次使用，请设置4位数字密码</p>'
        + '<input type="password" id="auth-pw1" maxlength="4" inputmode="numeric" pattern="[0-9]*" placeholder="设置密码" style="width:100%;height:50px;border:2px solid #ddd;border-radius:10px;text-align:center;font-size:24px;letter-spacing:12px;outline:none;margin-bottom:14px;" />'
        + '<input type="password" id="auth-pw2" maxlength="4" inputmode="numeric" pattern="[0-9]*" placeholder="确认密码" style="width:100%;height:50px;border:2px solid #ddd;border-radius:10px;text-align:center;font-size:24px;letter-spacing:12px;outline:none;margin-bottom:20px;" />'
        + '<button id="auth-set-btn" style="width:100%;height:48px;background:#1a73e8;color:#fff;border:none;border-radius:10px;font-size:17px;font-weight:600;cursor:pointer;">确认设置</button>'
        + '<p id="auth-error" style="color:#e53935;margin-top:12px;font-size:14px;"></p>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('auth-set-btn').onclick = function() {
        var pw1 = document.getElementById('auth-pw1').value;
        var pw2 = document.getElementById('auth-pw2').value;
        var err = document.getElementById('auth-error');

        if (!/^\d{4}$/.test(pw1)) { err.textContent = '请输入4位数字密码'; return; }
        if (pw1 !== pw2) { err.textContent = '两次密码不一致'; return; }

        dbUpdate('systemConfig', { key: AUTH_KEY, value: pw1 }, function() {
            saveDeviceToken();
            overlay.remove();
            showToast('密码设置成功');
        });
    };
}
/* ---------- 登录界面 ---------- */

function showLoginScreen() {
    var overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;z-index:999;display:flex;align-items:center;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText = 'text-align:center;padding:30px;width:80%;max-width:320px;';
    box.innerHTML = '<h2 style="margin-bottom:8px;color:#1a73e8;">沙场记账</h2>'
        + '<p style="color:#888;margin-bottom:30px;font-size:14px;">请输入密码</p>'
        + '<input type="password" id="auth-pw-input" maxlength="4" inputmode="numeric" pattern="[0-9]*" placeholder="4位数字密码" style="width:100%;height:50px;border:2px solid #ddd;border-radius:10px;text-align:center;font-size:24px;letter-spacing:12px;outline:none;margin-bottom:20px;" />'
        + '<button id="auth-login-btn" style="width:100%;height:48px;background:#1a73e8;color:#fff;border:none;border-radius:10px;font-size:17px;font-weight:600;cursor:pointer;">进入系统</button>'
        + '<p id="auth-error" style="color:#e53935;margin-top:12px;font-size:14px;"></p>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('auth-login-btn').onclick = function() {
        var pw = document.getElementById('auth-pw-input').value;
        var err = document.getElementById('auth-error');

        dbGetAll('systemConfig', function(configs) {
            var saved = null;
            for (var i = 0; i < configs.length; i++) {
                if (configs[i].key === AUTH_KEY) saved = configs[i].value;
            }
            if (pw === saved) {
                saveDeviceToken();
                overlay.remove();
                showToast('登录成功');
            } else {
                err.textContent = '密码错误，请重试';
                document.getElementById('auth-pw-input').value = '';
            }
        });
    };

    document.getElementById('auth-pw-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') document.getElementById('auth-login-btn').click();
    });
}
/* ---------- 保存设备令牌（免登录） ---------- */

function saveDeviceToken() {
    var token = { time: new Date().toISOString(), id: Math.random().toString(36) };
    dbUpdate('systemConfig', { key: AUTH_DEVICE, value: JSON.stringify(token) }, function() {});
}

/* ---------- 修改密码（在系统管理页面调用） ---------- */

function showChangePassword() {
    var bodyHTML = '<div class="form-section">'
        + '<label class="form-label">旧密码</label>'
        + '<input type="password" class="form-input" id="change-old-pw" maxlength="4" inputmode="numeric" placeholder="输入旧密码" />'
        + '</div>'
        + '<div class="form-section">'
        + '<label class="form-label">新密码</label>'
        + '<input type="password" class="form-input" id="change-new-pw" maxlength="4" inputmode="numeric" placeholder="输入新密码（4位数字）" />'
        + '</div>';

    showModal('修改密码', bodyHTML,
        '<button class="btn-secondary" onclick="closeModal()">取消</button>'
        + '<button class="btn-primary" onclick="doChangePassword()">确认</button>'
    );
}

function doChangePassword() {
    var oldPw = document.getElementById('change-old-pw').value;
    var newPw = document.getElementById('change-new-pw').value;

    if (!/^\d{4}$/.test(newPw)) { showToast('新密码必须是4位数字'); return; }

    dbGetAll('systemConfig', function(configs) {
        var saved = null;
        for (var i = 0; i < configs.length; i++) {
            if (configs[i].key === AUTH_KEY) saved = configs[i].value;
        }
        if (oldPw !== saved) { showToast('旧密码错误'); return; }

        dbUpdate('systemConfig', { key: AUTH_KEY, value: newPw }, function() {
            closeModal();
            showToast('密码已修改');
        });
    });
}

/* ---------- 启动时检查登录 ---------- */

document.addEventListener('DOMContentLoaded', function() {
    var pwPage = document.getElementById('page-password');
    if (pwPage) {
        var body = pwPage.querySelector('.page-body');
        if (body) {
            body.innerHTML = '<div class="settings-menu">'
                + '<div class="menu-item" onclick="showChangePassword()">'
                + '<span class="menu-text">修改密码</span>'
                + '<span class="menu-arrow">›</span>'
                + '</div></div>';
        }
    }

    setTimeout(function() {
        if (db) checkAuth();
    }, 500);
});
