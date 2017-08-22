var fs_extra = require('fs.extra');
var fs = require('fs');
var util = require('util');
var formidable = require('formidable');
var log4js = require('log4js');
var userHome = require('user-home');
var logger = log4js.getLogger();
var path = require('path');
var archiver = require('archiver');
var mime = require('mime');
var appRoot = require('app-root-path');
var shell = require('shelljs');

/**
 *  클라이언트에서 보내지는 데이터를 받아 처리한다.
 *  이 소스는 별도의 Node서버에서 실행 해야한다.
 *  NodeJS v6 LTS - KimYeonHo
 *  2017. 07. 28
 */
module.exports = function (app, db) {

    logger.level = 'debug';

    /**
     * 회원가입 및 이메일 등록체크
     */
    app.get('/api/v0.1/userSignupCheck', function (req, res) {
        var user_email = req.query.userEmail;
        db.query('SELECT COUNT(*) AS RESULT_COUNT FROM T_GOOGLE_APP_USER WHERE USER_EMAIL = ?',
            user_email, function (err, rows) {
            var count = rows[0].RESULT_COUNT;
            if (count > 0) {
                res.json({resultCode: count, resultMsg: '등록 된 이메일 입니다.'})
            } else {
                db.query('INSERT INTO T_GOOGLE_APP_USER (USER_EMAIL, CHAR_CODE, CHAR_YN, REG_DT) VALUES (?, ?, ?, now())',
                    [user_email, '', 'N'], function (err, results) {
                    if (err) throw err;
                    if (results.insertId > 0) {
                        logger.debug(user_email + " 님이 등록되었습니다.");
                        res.json({resultCode: 2, resultMsg: '등록 되었습니다.'});
                    }
                });
            }
        })
    });

    /**
     * 로그인 체크.
     * 등록된 이메일이 있는지 체크 후 로직을 실행한다.
     */
    app.get('/api/v0.1/userLoginCheck', function (req, res) {
        var user_email = req.query.userEmail;
        db.query('SELECT COUNT(*) AS RESULT_COUNT FROM T_GOOGLE_APP_USER WHERE USER_EMAIL = ?',
            user_email, function (err, rows) {
            var count = rows[0].RESULT_COUNT;
            if (count > 0) {
                logger.debug(user_email + ' -> 로그인 성공!')
                db.query('SELECT CHAR_CODE, CHAR_YN, DATE_FORMAT(CHAR_DT, "%Y-%m-%d %h:%i:%s") AS CHAR_DT  FROM T_GOOGLE_APP_USER WHERE USER_EMAIL = ?',
                    user_email, function (err, data) {
                    var char_yn = data[0].CHAR_YN;
                    var char_dt = data[0].CHAR_DT;
                    var char_code = data[0].CHAR_CODE;
                    res.json({
                        resultCode: count,
                        session: user_email,
                        char_code: char_code,
                        char_yn: char_yn,
                        char_dt: char_dt
                    })
                });
            } else {
                logger.debug(user_email + ' -> 로그인 실패!')
                res.json({resultCode: count, resultMsg: '등록된 아이디가 없습니다.'})
            }
        })
    });

    /**
     * 등록된 사용자 정보를 가져온다.
     */
    app.get('/api/v0.1/getUser', function (req, res) {
        var user_email = req.query.userEmail;
        db.query('SELECT USER_EMAIL, CHAR_CODE, CHAR_YN, DATE_FORMAT(CHAR_DT, "%Y-%m-%d %h:%i:%s") AS CHAR_DT FROM T_GOOGLE_APP_USER WHERE USER_EMAIL = ?',
            user_email, function (err, data) {
            var char_yn = data[0].CHAR_YN
                , char_dt = data[0].CHAR_DT
                , char_code = data[0].CHAR_CODE
                , email = data[0].USER_EMAIL;
            res.json({resultCode: 1, user_email: email, char_code: char_code, char_yn: char_yn, char_dt: char_dt})
        });
    });

    /**
     * 선택한 파일을 서버로 업로드 한다.
     */
    app.post('/api/v0.1/hudLayoutUpload', function (req, res) {

        // 캐릭터 코드
        var charDir = req.query.code;

        // 유저 이메일
        var user_email = req.query.email;

        // 폼 데이타
        var form = new formidable.IncomingForm();
        form.multiples = true;

        form.parse(req, function (err, fields, files) {
            res.writeHead(200, {'content-type': 'text/plain'});
            res.write('received upload:\n\n');
            res.end(util.inspect({fields: fields, files: files}));
        });

        form.on('end', function (fields, files) {
            logger.debug("총 업로드 파일 갯수 == ", this.openedFiles.length);

            // 업로드 파일리스트
            var files = this.openedFiles;

            // 서버 업로드 기본경로
            //var new_location = 'd:\\upload/';
            var new_location = '/usr/local/upload/';
            var r = 0;

            // 이곳에서 먼저 사용자별 캐릭터 식별코드를 디비조회한다.
            db.query("SELECT CHAR_YN FROM T_GOOGLE_APP_USER WHERE USER_EMAIL = ?", user_email, function (err, rows) {
                if (err) throw err;
                // 업로드를 사용하지 않고 있다면,
                if (rows[0].CHAR_YN == 'N') {
                    try {
                        // 새경로에 파판 캐릭터 식별코드 이름으로 폴더를 동기화 생성한다.
                        fs_extra.mkdirpSync(new_location + charDir);
                        logger.debug('폴더명: ' + charDir + ' -> 생성완료');
                    } catch (e) {
                        throw e;
                    }

                    for (var i = 0; i < files.length; i++) {
                        // 임시 업로드경로
                        var temp_path = files[i].path;
                        // 코드명+파일명
                        var file_name = files[i].name;

                        // temp_path 로 받은 파일을, 원래 이름으로 변경하여 이동시킨다.
                        fs_extra.move(temp_path, new_location + charDir + "/" + file_name, function (err) {
                            if (err)  console.error(err);
                        });
                        if (i == files.length - 1)  r = 1;
                    } // END for

                    if (r > 0) {
                        // 업로드 완료시 디비내 개인 데이터의 캐릭터 코드값과 사용여부를 업데이트한다.
                        db.query("UPDATE T_GOOGLE_APP_USER SET CHAR_CODE = ?, CHAR_YN = 'Y', CHAR_DT = NOW() WHERE USER_EMAIL = ?",
                            [charDir, user_email], function (err, rows) {
                            if (err) throw err;
                            logger.debug('캐릭터 코드: ' + charDir + ' -> 사용등록 완료');

                            fs.readdir(new_location + charDir + '/', function (err, data) {
                                var zipName = new_location + charDir + '/' + charDir + ".zip",
                                    fileArray = getDirectoryList(new_location + charDir + '/'),
                                    output = fs.createWriteStream(zipName),
                                    archive = archiver('zip');

                                // 데이터를 파이프로 내보냄
                                archive.pipe(output);

                                // 파일의 갯수만큼 아카이브에 추가
                                fileArray.forEach(function (item) {
                                    var file = item.path + item.name;
                                    archive.append(fs.createReadStream(file), {name: item.name});
                                });

                                // stream final
                                archive.finalize();

                                // 압축이 완료되었다면,
                                output.on('close', function () {
                                    // 폴더 하위에 업로드 파일을 모두 삭제한다.
                                    rmDir(fileArray);

                                    // 파일목록을 다시 가져온다.
                                    var zipFile = getDirectoryList(new_location + charDir + '/');
                                    if (zipFile.length == 1) {

                                        // 실제 업로드 경로에서 프로젝트 경로로 복사한다.
                                        shell.cp('-R', new_location + charDir + '/', appRoot + '/routes/upload');
                                        logger.debug(new_location + charDir + " -> " + appRoot + '/routes/upload' + " 복사 완료!\n");
                                        logger.debug(zipFile[0].path + zipFile[0].name + " 업로드 완료!\n");
                                    }
                                });
                            });
                        });
                    }
                }
            });
        });
        return;
    });

    var getDirectoryList = function (dir) {
        var fileArray = [],
            files = fs.readdirSync(dir);
        files.forEach(function (file) {
            var obj = {name: file, path: dir};
            fileArray.push(obj);
        });
        return fileArray;
    };

    /**
     * 파일 및 폴더삭제
     * @param dirPath
     */
    var rmDir = function (files) {
        files.forEach(function (file) {
            fs.unlinkSync(file.path + file.name);
        });
    };

    var deleteFolderRecursive = function (dirPath) {
        try { var files = fs.readdirSync(dirPath); }
        catch (e) { return; }
        if (files.length > 0) {
            for (var i = 0; i < files.length; i++) {
                var filePath = dirPath + files[i];
                if (fs.statSync(filePath).isFile())
                    fs.unlinkSync(filePath);
                else
                    deleteFolderRecursive(filePath);
            }
        }
    };

    // UI 백업
    app.post('/api/v0.1/putHudBackup', function (req, res) {
        // 캐릭터 코드
        var charDir = req.query.code;

        // 유저 이메일
        var user_email = req.query.email;

        // 폼 데이타
        var form = new formidable.IncomingForm();
        form.multiples = true;

        form.parse(req, function (err, fields, files) {
            res.writeHead(200, {'content-type': 'text/plain'});
            res.write('received upload:\n\n');
            res.end(util.inspect({fields: fields, files: files}));
        });

        form.on('end', function (fields, files) {
            logger.debug("총 업로드 파일 갯수 == ", this.openedFiles.length);

            // 업로드 파일리스트
            var files = this.openedFiles;

            // 서버 업로드 기본경로
            // 백업을 사용한다는것은 1번이라도 업로드를 했으므로, 해당 캐릭터코드 디렉토리까지 경로를 잡는다.
            //var new_location = 'd:\\upload/' + charDir + '/';
            var new_location = '/usr/local/upload/' + charDir + '/';

            var r = 0;

            // 저장되어있는 압축파일 삭제
            deleteFolderRecursive(new_location)
            logger.debug('저장된 압축파일이 삭제되었습니다.');

            for (var i = 0; i < files.length; i++) {
                // 임시 업로드경로
                var temp_path = files[i].path;
                // 코드명+파일명
                var file_name = files[i].name;

                // temp_path 로 받은 파일을, 원래 이름으로 변경하여 해당 경로로 이동시킨다.
                fs_extra.move(temp_path, new_location + file_name, function (err) {
                    if (err) console.error(err)
                });
                if (i == files.length - 1) r = 1
            } // end for

            if (r > 0) {

                // 업로드 완료시 디비내 개인 데이터의 캐릭터 코드값과 사용여부를 업데이트한다.
                db.query("UPDATE T_GOOGLE_APP_USER SET CHAR_DT = NOW() WHERE USER_EMAIL = ?", [user_email], function (err, rows) {
                    if (err) throw err;
                    logger.debug('캐릭터 코드: ' + charDir + ' -> 백업 완료');

                    // 캐릭터디렉토리를 읽어들인다.
                    fs.readdir(new_location, function (err, data) {
                        var zipName = new_location + charDir + ".zip",
                            fileArray = getDirectoryList(new_location),
                            output = fs.createWriteStream(zipName),
                            archive = archiver('zip');

                        // 데이터를 파이프로 내보냄
                        archive.pipe(output);

                        // 파일의 갯수만큼 아카이브에 추가
                        fileArray.forEach(function (item) {
                            var file = item.path + item.name;
                            archive.append(fs.createReadStream(file), {name: item.name});
                        });

                        // stream final
                        archive.finalize();

                        // 압축이 완료되었다면,
                        output.on('close', function () {
                            // 폴더 하위에 업로드 파일을 모두 삭제한다.
                            rmDir(fileArray);

                            // 파일목록을 다시 가져온다.
                            var zipFile = getDirectoryList(new_location);
                            if (zipFile.length == 1) {

                                // 실제 업로드 경로에서 프로젝트 경로로 복사한다.
                                shell.cp('-R', new_location, appRoot + '/routes/upload');
                                logger.debug(new_location + " -> " + appRoot + '/routes/upload' + " 복사 완료!\n");

                                logger.debug(zipFile[0].path + zipFile[0].name + " 백업 완료!\n");
                            }
                        });
                    });
                });
            }
        });
        return;
    });
};