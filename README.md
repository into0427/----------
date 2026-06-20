스퀘어배틀 - 올스타전

브롤스타즈 스타일의 탑뷰 4:4 팀배틀 게임!

실행 방법

방법 1 (추천): VS Code Live Server


VS Code에서 폴더 열기 (File > Open Folder)
Live Server 익스텐션 설치 (Extensions에서 "Live Server" 검색 → Install)
index.html을 열고 우하단의 Go Live 버튼 클릭
브라우저에서 자동으로 열림!


방법 2: npm serve

bashcd square-battle
npm start
# → http://localhost:3000 접속

방법 3: Python

bashcd square-battle
python -m http.server 3000
# → http://localhost:3000 접속


⚠️ index.html을 브라우저에 그냥 드래그해서 열면 ES Module 오류 남!
반드시 로컬 서버로 실행해야 해.




조작법

키 / 입력동작WASD / 방향키이동마우스조준마우스 왼쪽 클릭 (홀드)공격E궁극기 사용R (게임 오버 후)재시작

캐릭터

이름체력속도특징빨강이10005권총 / 궁: 울트라샷 (관통, 고데미지)파랑이10005권총 / 궁: 메가폰 레이저 (3레이저 추적)티라노18003단검 근접 / 궁: 공룡 소환 탑승 (화염)타이탄24004방망이 / 궁: 지진 (넉백+스턴)캐논16001.5대포 (초고데미지, 반동) / 궁: 충격파

규칙


4:4 팀전 (플레이어 1명 + AI 3명 vs AI 4명)
먼저 20킬을 달성한 팀이 승리
사망 후 3초 뒤 부활
맵은 매판 랜덤 생성