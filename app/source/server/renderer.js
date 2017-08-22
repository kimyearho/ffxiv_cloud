const {ipcRenderer} = require('electron');
const {BrowserWindow, app} = require('electron').remote;
const os = require('os');
const fs = require('fs');
const unzip = require('unzip');
const homeDir = os.homedir();
const $ = require('jquery');

// 로컬 경로
$('#document_path').html(homeDir + '\\Documents\\My Games\\FINAL FANTASY XIV - A Realm Reborn');

let domain = 'http://nodestory.com';

$('#btn_login').on('click', function() {
    // 이메일 폼
    let email_input =  $('#email').val();
    if(email_input == '') {
        alert('이메일을 입력하세요.');
        $('#email').focus();
    } else {
        // 이메일 정규식
        let regEmail = /([\w-\.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([\w-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$/;
        if(!regEmail.test(email_input)) {
            alert('올바른 이메일 형식이 아닙니다.');
            $('#email').val('');
            $('#email').focus();
            return false;
        } else {
            $.get(domain + '/api/v0.1/userLoginCheck?userEmail='+email_input, function(data) {
                if(data.resultCode == 1) {
                    // 로그인 처리
                    ipcMainConnection(data);
                } else {
                    // 로그인 실패
                    alert(data.resultMsg);
                    return false;
                }
            });
        }
    }
});

// 회원가입
$('#btn_signup').on('click', function() {
    // 이메일 폼
    let email_input =  $('#email').val();
    if(email_input == '') {
        alert('이메일을 입력하세요.');
        $('#email').focus();
    } else {
        // 이메일 정규식
        let regEmail = /([\w-\.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([\w-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$/;
        if(!regEmail.test(email_input)) {
            alert('올바른 이메일 형식이 아닙니다.');
            $('#email').val('');
            $('#email').focus();
            return false;
        } else {
            $.get(domain + '/api/v0.1/userSignupCheck?userEmail='+email_input, function(data) {
                if(data.resultCode == 1) {
                    alert(data.resultMsg);
                    return false;
                } else {
                    alert(data.resultMsg);
                    location.href = 'login.html';
                }
            });
        }
    }
});

// UI 적용
$('#ui_accept').on('click', function() {
    let char_code = $('#session_form').attr('code');
    if(char_code == '') {
        alert('저장한 데이터가 없어 UI 적용을 사용할 수 없습니다.');
        return false;
    } else {
        let document_path = $('#document_path').text();
        let charCode = $('#session_form').attr('code');
        let fileName = charCode + '.zip';
        let downloadUrl = 'http://nodestory.com/upload/' + charCode + '/' + fileName;

        var array = new Object();
        array.url = downloadUrl;
        array.path = document_path;
        array.code = charCode;
        array.fileName = fileName;

        // /유저명/내문서/My Games 폴더가 없으면
        if (!fs.existsSync(homeDir + '/Documents/My Games')) {
            // 생성해준다.
            fs.mkdirSync(homeDir + '/Documents/My Games');
        }

        // 유저명/내문서/My Games/FINAL FANTASY XIV - A Realm Reborn 폴더가 없으면
        if (!fs.existsSync(homeDir + '/Documents/My Games/FINAL FANTASY XIV - A Realm Reborn')) {
            // 생성해준다.
            fs.mkdirSync(homeDir + '/Documents/My Games/FINAL FANTASY XIV - A Realm Reborn');
        }
        
        // 메인 프로세스 통신
        ipcRenderer.send('DOWNLOAD_UI', array);
    }
});

// 다운로드 완료 후 압축해제
ipcRenderer.on('DOWNLOAD_COMPLETED', (event, args) => {
    // 내문서내 파판경로
    let downloadPath = args.path;
    
    // 파일명
    let fileName = args.fileName;
    
    // 캐릭터 코드
    let charCode = args.charCode;

    // 파판 내문서 경로에서 압축을 해제한다.
    fs.createReadStream(downloadPath + '/' + fileName).pipe(unzip.Extract({ path: downloadPath + '/' + charCode }));
    fs.unlinkSync(downloadPath + '/' + fileName);

    setTimeout(function(){  alert('UI 적용완료'); }, 1500);
});

// UI 백업
$('#ui_backup').on('click', function() {
    let char_code = $('#session_form').attr('code');
    if(char_code == '') {
        alert('저장한 데이터가 없어 백업을 사용할 수 없습니다.');
        return false;
    } else {
        let document_path = $('#document_path').text() + '\\' + char_code + "\\";
        $('#files').trigger('click');
    }
});

// 메인 프로세스와 통신
function ipcMainConnection(session) {
    ipcRenderer.send('LOGIN_SUCCESS', session)
}
