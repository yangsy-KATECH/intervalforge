# IntervalForge 1.1.0

Windows에서 준비하고 무료 HTTPS 정적 호스팅으로 배포한 뒤 iPhone Safari에서 홈 화면에 추가하는 운동 타이머 PWA입니다. Mac, Xcode, 유료 Apple 계정, npm 설치나 빌드 과정은 필요하지 않습니다. App Store 앱이나 IPA가 아닙니다.

## 1. 이번 변경

- 준비시간 설정: 기본10초, 0~600초. 0초이면 생략합니다.
- 준비는 시작 시 딱1회만 진행합니다. 준비 → 운동/휴식 반복 → 완료.
- 일시정지·재개 및 화면 복귀는 같은 지점부터 이어갑니다. 준비를 다시 삽입하지 않습니다.
- 초기화 후 새 시작 또는 완료 후 다시 시작은 준비부터 진행합니다.
- 메인에는 큰 현재 구간 타이머, 시작/일시정지/재개/다시 시작, 초기화, 설정 버튼만 표시합니다.
- 구간·라운드·전체 진행률·전체 시간·완료 상세·운동 설정·소리·화면 유지·잠금 안내·iPhone 설치/오프라인 안내·업데이트·테스트 링크는 설정 화면으로 이동했습니다.
- 설정을 열어도 진행 중인 운동은 멈추지 않습니다. 멈추려면 메인에서 일시정지를 누르세요.
- 실행 및 일시정지 중 운동값은 잠기며 초기화 후 변경 가능합니다. 소리/음량/화면 유지 옵션은 변경할 수 있습니다.
- 잘못된 입력이 있으면 설정 화면에서 오류를 해결한 뒤 메인으로 돌아갈 수 있습니다.

메인의 숫자는 해당 시점의 준비/운동/휴식 구간 남은 시간입니다. 준비는 노랑, 운동은 네온 그린, 휴식은 시안으로 구분합니다. 구간 이름과 라운드 숫자는 설정에서 확인합니다.

## 2. 기본값과 합계

|모드|운동 및 휴식만|준비 기본값|준비 포함 전체|
|---|---|---|---|
|Tabata 20/10 × 8|04:00|00:10|04:10|
|EMOM 60초 × 10|10:00|00:10|10:10|
|AMRAP 600초|10:00|00:10|10:10|
|Interval 20/10 × 8|03:50|00:10|04:00|

Tabata는 기존 정책대로 마지막10초 회복을 포함합니다. Interval은 마지막 운동 뒤 휴식을 제외합니다. Interval1회이면 운동만 진행하고, 휴식0초이면 휴식 구간을 생성하지 않습니다.

입력 범위: 준비0~600초, 운동/EMOM 간격1~3600초, 휴식0~3600초, 라운드1~200회, AMRAP1~21600초입니다. 준비를 포함한 전체 시간은 최대6시간입니다. 빈값·음수·소수·문자·과도한 값을 거부합니다.

## 3. 전체 파일

    IntervalForge/
      index.html
      styles.css
      app.js
      timer-core.js
      cue-controller.js
      audio.js
      storage.js
      pwa.js
      manifest.webmanifest
      service-worker.js
      icons/
        icon-192.png
        icon-512.png
        icon-maskable-512.png
        apple-touch-icon.png
        favicon-32.png
        icon.svg
      tests/
        index.html
        browser-tests.js
        test-suite.js
        run-tests.mjs
      serve.py
      start-local.cmd
      package.json
      README.md
      TEST-RESULTS.md
      .nojekyll
      .gitignore

생성기에서 자동 검사를 실행한 뒤 ZIP을 만들면 해당 브라우저의 상세 결과 JSON도 추가됩니다. 아이콘은 생성기가 Canvas로 직접 그린 실제 PNG입니다. 외부 폰트·라이브러리·음원·분석 SDK·Push 서버를 사용하지 않습니다.

## 4. Windows 실행

1. 생성기 HTML을 Edge/Chrome에서 열고 로직 자동 검사를 실행합니다.
2. 프로젝트 ZIP 만들기 또는 생성한 ZIP 저장을 누릅니다.
3. ZIP을 우클릭 → 모두 압축 풀기. ZIP 내부에서 바로 사용하지 마세요.
4. index.html과 icons, tests 폴더가 보이는 프로젝트 내부로 들어갑니다.
5. 선택적으로 Python3가 있다면 그 폴더에서 다음을 실행합니다.

    py -3 serve.py

또는 start-local.cmd를 실행합니다. 브라우저가 열리지 않으면 http://localhost:8000/ 으로 접속합니다. 종료는 터미널에서 Ctrl+C입니다. py가 없고 python이 Python3라면 python serve.py를 사용할 수 있습니다.

Python 설치는 선택 사항이며 https://www.python.org/downloads/windows/ 에서 무료로 받을 수 있습니다. 무료 편집기 VS Code도 선택 사항입니다: https://code.visualstudio.com/

생성기 HTML은 파일 더블클릭으로 열 수 있지만, 생성된 앱의 index.html은 JavaScript 모듈·서비스 워커 정책 때문에 file:// 더블클릭 실행용이 아닙니다. 앱은 localhost 서버 또는 배포 HTTPS 주소로 여세요.

iPhone의 localhost는 Windows PC를 의미하지 않습니다. 일반적인 같은 Wi-Fi의 HTTP IP 주소는 PWA 보안 컨텍스트가 아니므로 iPhone 설치·오프라인 검사는 배포 HTTPS 주소를 사용하세요.

## 5. 무료 GitHub Pages 배포

기본 경로는 GitHub Free의 공개 저장소입니다. 공개 소스·사이트에 비밀번호·개인정보·토큰을 넣지 마세요. 정책·메뉴는 바뀔 수 있으며 아래 공식 문서도 확인하세요.

1. https://github.com/ 에서 무료 계정을 만들고 이메일을 인증합니다.
2. https://github.com/new 에서 저장소 이름 intervalforge, Public, Add README를 선택하고 Create repository를 누릅니다.
3. Code → Add file → Upload files를 엽니다.
4. 압축을 푼 프로젝트 폴더 안에서 파일 전부와 icons, tests 폴더를 함께 끌어다 놓습니다.
5. ZIP 자체나 바깥 IntervalForge 폴더를 한 단계 감싸 올리지 마세요. 저장소 첫 화면에 index.html이 바로 보여야 합니다.
6. Commit changes로 main 브랜치에 저장합니다.
7. Settings → Pages → Build and deployment → Source: Deploy from a branch.
8. Branch: main, 폴더: /(root), Save. Custom domain은 비워 둡니다.
9. Actions에서 Pages 배포 성공을 확인합니다. 반영에는 시간이 걸릴 수 있습니다.
10. Settings → Pages의 Visit site로 실제 주소를 확인합니다. 주소는 대개 https://본인계정.github.io/intervalforge/ 형태입니다. 이는 형식 예시이지 대신 생성한 사이트 주소가 아닙니다.
11. https:// 접속과 Enforce HTTPS 항목을 확인합니다. 기본 github.io 도메인으로 충분합니다.

아이콘·테스트 폴더 드래그가 안 되면 Add file → Create new file에서 icons/.gitkeep, tests/.gitkeep을 만든 뒤 각각의 GitHub 폴더 안으로 들어가 내부 파일을 업로드하세요. PNG는 icons 안에, 테스트는 tests 안에 원래 구조대로 있어야 합니다. 폴더 생성용 .gitkeep은 아이콘·테스트를 대신하지 않습니다.

오프라인 설치는 service-worker.js의 ASSETS 중 하나라도404가 나면 실패할 수 있습니다. 모든 PNG와 테스트 파일을 포함하세요. .nojekyll이 빠졌으면 같은 이름의 빈 파일을 저장소 최상위에 추가할 수 있습니다.

## 6. iPhone 설치와 사용

1. iPhone을 인터넷에 연결하고 Safari에서 실제 배포 HTTPS 주소를 엽니다. GitHub 소스 화면이 아닙니다.
2. 공유 → 홈 화면에 추가를 선택합니다. Safari 레이아웃에 따라 페이지 메뉴 안에 공유가 있을 수 있습니다.
3. 웹 앱으로 열기가 보이면 켜고 이름을 확인한 뒤 추가합니다.
4. 홈 화면 아이콘으로 온라인에서 한 번 실행합니다.
5. 메인 오른쪽 위 설정을 누릅니다.
6. 운동 설정에서 모드·준비·운동·휴식·라운드를 정합니다.
7. 효과음 테스트 / 활성화를 직접 누르고 기기 미디어 음량·무음·출력 장치를 확인합니다.
8. 설정 안의 오프라인 상태와 홈 화면 앱 표시를 확인합니다.
9. 타이머로 돌아가기를 누른 뒤 시작합니다.

Safari와 홈 화면 앱은 저장 컨텍스트가 별도일 수 있습니다. Safari에서 캐시를 준비했다고 홈 화면 앱에도 준비되었다고 가정하지 마세요. iOS 버전에 따라 메뉴와 API 지원이 달라집니다. 이 프로젝트는 manifest standalone·Apple 메타 태그·apple-touch-icon을 제공합니다.

## 7. 오프라인과 화면 잠금

온라인에서 홈 화면 앱의 설정 → 오프라인 준비 상태를 확인한 뒤 닫습니다. 비행기 모드를 켜고 Wi-Fi도 끈 후 같은 홈 화면 아이콘으로 열어 테스트하세요. 캐시가 남아 있다면 핵심 화면·모드·타이머·소리를 사용할 수 있습니다. 저장 공간 정리·사이트 데이터 삭제·앱 제거로 캐시가 사라지면 온라인에서 다시 준비해야 합니다.

화면 잠금·다른 앱·Safari/PWA 프로세스 종료 시 JavaScript와 오디오가 중단될 수 있습니다. 준비를 포함한 실제 시각으로 복귀 상태를 계산하지만, 잠금 중 구간별 효과음·예약 알림은 보장하지 않습니다. 지나간 효과음을 몰아서 재생하지 않습니다.

서비스 워커는 오프라인 파일과 업데이트만 담당합니다. 무한 백그라운드 타이머가 아닙니다. Screen Wake Lock은 지원·허용되는 전면 환경에서만 요청하며 수동 잠금이나 시스템 해제를 막지 못합니다.

iOS16.4 이상 홈 화면 웹 앱은 조건을 갖추면 Web Push를 사용할 수 있지만, 이 프로젝트에는 구독·발송 서버·예약 알림 구현이 없습니다. HTTPS·설치·직접 동작에 따른 권한과 발송 구현이 필요하고, Push를 추가해도 초 단위 전달은 보장되지 않습니다. API 감지는 예약 알림 동작을 의미하지 않습니다.

## 8. 시간 계산과 저장 호환

상태는 idle → running ↔ paused → finished이며 초기화하면 idle입니다. 준비는 별도 prepare 구간이고 라운드0으로 내부 표현하되, 화면에는 준비 중으로 표시합니다.

    경과 = 이전 경과 밀리초 + max(0, 현재 시각 - 이번 시작/재개 시각)
    목표 종료 = 이번 시작/재개 시각 + 전체 길이 - 이전 경과

UI 콜백 횟수로1초씩 빼지 않습니다. 누적 구간 경계를 사용하므로 여러 구간이 지난 뒤에도 현재 구간을 바로 찾습니다. 일시정지는 경과 밀리초를 고정하고 재개는 새 기준 시각을 사용합니다. 화면 루프는 하나이고 숨김·일시정지·초기화 때 중지합니다.

설정·시작·전환·숨김·pagehide와 전면 보조 저장을 사용합니다. localStorage 접근 실패 시 메모리에서 타이머는 계속 작동하지만 재실행 복원은 보장되지 않습니다. 기기 시계가 맞아야 하며 수동 시각 변경을 완전히 보정하지는 않습니다.

기존 설정에 준비 항목이 없으면10초를 추가합니다. 다만 구버전에서 이미 실행/일시정지/완료된 세션은 기존 시간축을 보존하기 위해 준비0으로 복원합니다. 초기화 후 설정의 준비시간을 확인하세요. 새 세션 형식은 schema2이고 기존 저장 키를 유지합니다.

설정을 열고 닫는 것만으로 일시정지·초기화하지 않습니다. 완료 상태도 값이 바뀌지 않으면 유지합니다. 모드·시간을 실제로 수정하면 대기로 돌아갑니다. 여러 탭에서 동시에 운동하면 마지막 저장이 서로 덮어쓸 수 있으므로 한 창만 사용하세요.

## 9. 오디오

준비 시작: 중간2음, 운동 시작: 높은2음, 휴식: 낮은1음, EMOM: 구별되는2음, 완료: 상승3음입니다. 준비·운동·휴식의 마지막3·2·1초는 각1회만 냅니다. 3초 이하 구간의 첫 순간에는 시작음을 우선하여 같은 순간의 카운트다운과 겹치지 않습니다.

사용자 직접 시작/재개/활성화 동작에서 Web Audio를 활성화합니다. 일시정지·음소거·숨김·초기화 때 예약된 짧은 음을 취소합니다. 복귀 시 지난 신호는 생략합니다. 오디오 생성·resume·출력 실패는 타이머를 멈추지 않습니다. 복귀 후 소리가 중단되어 있으면 설정의 효과음 테스트 / 활성화를 직접 누르세요. 운동 중에는 이 버튼이 추가 테스트음을 섞지 않고 활성화만 합니다.

백그라운드 유지를 위한 무음 루프·지속 오디오는 없습니다. 앱 음량과 기기 음량은 별개이고 전화·출력 장치·OS 정책이 소리에 영향을 줄 수 있습니다.

## 10. 자동 검사와 실제 실행 범위

생성기의 로직 자동 검사 또는 앱의 설정 → 맨 아래 자동 테스트를 사용하세요. Node18 이상이 이미 있으면 아래 명령도 가능합니다. npm install은 필요하지 않습니다.

    node tests/run-tests.mjs

기존 회귀 테스트는 준비0을 명시적으로 적용합니다. 추가32개는 새 기본 준비10초, 준비 생략, 단일 준비 구간, 네 모드, 일시정지/재개, 구버전 호환, 저장·복원, 카운트다운 중복, 오디오 OFF, 입력 검증 등을 검사합니다.

제작 환경에서 추가 로직32개 및 주요 화면23개를 Chromium143 메모리 하네스로 실행하여 통과했습니다. UI 검사에서는 단순화한 원본 DOM·일부 CSS와 대체 PWA 계층을 사용했습니다. 전체 기존 테스트 모음·생성기 전체·서비스 워커 캐시/업데이트·실제 스피커·실제 iPhone을 검증한 것은 아닙니다. TEST-RESULTS.md에 범위를 구분했습니다.

## 11. 실기기 체크리스트

아래는 예상 결과이며 실제 iPhone 결과가 아닙니다. 기기·iOS·저전력 모드·Safari/홈 화면 여부·실측 결과를 따로 기록하세요.

|번호|설정/절차|예상 결과|
|---|---|---|
|1|Tabata 준비10/운동20/휴식10/8회|준비1회 후 운동·휴식, 전체04:10|
|2|준비0/Tabata20/10/8|즉시 운동, 마지막 회복 포함04:00|
|3|준비3/Interval5/4/2|준비3→운동5→휴식4→운동5→완료, 준비 반복 없음|
|4|준비 또는 운동 중 일시정지→10초 대기→재개|남은 밀리초부터 진행, 준비 재시작 없음|
|5|초기화 취소 후 다시 확인|취소는 유지, 확인하면 준비부터 대기, 설정 유지|
|6|준비0/Interval5/10/1|5초만 운동, 마지막 휴식 없음|
|7|준비0/운동5/휴식0/3|연속3라운드 총15초|
|8|준비2/AMRAP7|준비2초 뒤 운동7초, 종료 음수 없음|
|9|준비2/EMOM5초/3회|준비 뒤5초마다 전환, 전체17초|
|10|5초 이상 구간의 마지막3초|3·2·1 각1회, 전환음 중복 없음|
|11|실행 중 설정 열기·돌아오기|타이머는 계속 진행, 운동값 잠김, 재시작 없음|
|12|준비10/Tabata20/10/8 시작 후 다른 앱, 약45초 후 복귀|2라운드 운동 약15초, 지난 소리는 생략|
|13|위 설정으로35초 화면 잠금 후 복귀|1라운드 휴식 약5초, 잠금 중 소리 보장 안 함|
|14|프로세스 종료 뒤 같은 저장 위치에서 재실행|저장소가 남으면 실제 시각 상태 복원, 일시정지는 고정|
|15|온라인 캐시 준비 후 비행기 모드 재실행|캐시가 남으면 화면·타이머 사용|
|16|홈 화면 아이콘으로 실행|standalone 화면, 설정 안의 홈 화면 앱 표시|
|17|작은 세로·가로 화면과 회전|숫자·버튼 유지, 필요 시 세로 스크롤|
|18|준비 빈값/음수/601초/소수|오류와 시작 거부, 수정 후 정상 복귀|
|19|효과음 OFF/ON, 음량0/70|시간은 계속, 이후 신호만 재생|
|20|완료 뒤 설정 왕복 및 다시 시작|왕복은 완료 유지, 다시 시작은 준비부터|
|21|새 버전 배포 후 업데이트|설정에서 확인, 운동 중 적용 불가, 완료/초기화 후 적용|

잠금 중 소리와 복귀 후 시간 상태는 반드시 별도 판정하세요. 소리를 놓치면 안 되는 운동은 앱을 전면에 두고 화면을 켜 두는 방식이 기본 대안입니다.

Windows Edge/Chrome에서는 F12 → Console의 예상하지 못한 오류, Network의404, Application의 Manifest·Service Workers·Cache Storage를 확인하세요. Chromium 확인은 iOS WebKit 검증을 대신하지 않습니다.

## 12. 1.1.0 업데이트 배포

1. 수정된 생성기를 다시 HTML로 저장해 Edge/Chrome에서 엽니다.
2. 로직 자동 검사 후 새 프로젝트 ZIP을 만듭니다.
3. 압축을 풀고 프로젝트 내부 파일들을 기존 GitHub 저장소의 같은 위치에 덮어씁니다. 생성기 자체나 ZIP만 올리지 마세요.
4. Commit changes 후 Actions에서 배포 성공을 확인합니다.
5. iPhone에서 기존 앱의 업데이트 확인을 누릅니다. 구버전은 메인 아래, 새 버전은 설정 안에 있습니다.
6. 새 버전 적용 버튼이 나타나면 운동을 완료하거나 초기화한 뒤 누릅니다. 설치가 비동기이므로 버튼 준비까지 잠시 기다려야 할 수 있습니다.
7. 설정 맨 아래 IntervalForge1.1.0과 준비시간 항목을 확인합니다.

서비스 워커 VERSION은1.1.0으로 갱신했습니다. 다음 변경 때는1.1.1처럼 올리고 캐시 대상 파일 변경도 반영하세요. 오래된 같은 앱 캐시는 정리하지만 localStorage 설정을 의도적으로 삭제하지 않습니다. 업데이트 시 여러 창을 닫고 온라인에서 한 창으로 확인하는 것이 안전합니다.

변경 파일은 index.html, styles.css, app.js, timer-core.js, cue-controller.js, audio.js, storage.js, service-worker.js, tests/test-suite.js, package.json, README.md, TEST-RESULTS.md입니다. 나머지도 프로젝트 전체에 포함합니다. 기존 icons·tests 폴더를 삭제하지 마세요.

## 13. 알려진 제한과 공식 참고

로그인·기기간 동기화·기록 목록·AMRAP 횟수 기록·이름 있는 프리셋·다중 창 잠금·Push 서버는 이 버전의 범위 밖입니다. 사이트 데이터 삭제·앱 제거·저장 공간 정책으로 상태와 캐시가 사라질 수 있습니다. 공개 호스팅 사업자는 일반 접속 로그를 처리할 수 있습니다.

- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages
- Pages 소스 설정: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- HTTPS: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- Apple 홈 화면 웹 앱: https://support.apple.com/ko-kr/guide/iphone/iphea86e5236/ios
- WebKit Web Push 조건: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Safari26 홈 화면 동작: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- Web Audio 정책: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- 화면 유지 조건: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
