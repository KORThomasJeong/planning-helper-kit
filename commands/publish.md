---
description: 기획 문서를 GitHub 저장소에 올린다 (비공개 기본)
allowed-tools: Bash, Read, Write, AskUserQuestion
---

# /ph:publish

루트에 `README.md`·`CLAUDE.md` 를 만들고, 이 폴더를 GitHub 저장소로 올린다.
올린 저장소를 개발 담당자나 AI 코딩 도구가 그대로 받아 구현을 시작할 수 있다.

사용자에게는 쉬운 한국어로만 말한다("커밋·푸시" 대신 "올리기", "저장소" 정도는 써도 된다).

**로그인·토큰 규칙 — 반드시 지킨다**
- GitHub 로그인은 GitHub CLI(`gh`)에 맡긴다. 토큰·비밀번호를 대화창에 붙여넣게 하지 않는다.
  사용자가 붙여넣으면 쓰지 말고 "그 토큰은 노출됐으니 GitHub 에서 폐기하고 새로 만드세요"라고 안내한다.
- 토큰 값을 출력하지 않는다(`gh auth token` 실행 금지). 로그인 여부는 `gh auth status` 로만 본다.
- 토큰을 원격 주소(URL)나 `.git/config` 에 넣지 않는다.
- 강제로 덮어써서 올리지 않는다(`git push --force` 금지).

Windows Git Bash 주의: 슬래시로 시작하는 단독 인자는 경로로 바뀔 수 있으니 `gh api` 경로는 `user` 처럼 슬래시 없이 쓴다.
한글이 든 응답은 파일로 받아 `node` 로 읽는다.

## 1. 올릴 내용 준비

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" status --json
```

- PRD 가 없으면 "올릴 문서가 아직 없어요 — /ph:next" 하고 멈춘다.
- 개발 명세서·일관성 점검이 없거나 "다시 만들기 권장" 경고가 있으면 한 줄로 알리고 AskUserQuestion `그래도 올리기` / `먼저 마저 하기`.
- 루트에 `README.md`·`CLAUDE.md` 가 이미 있는데 `planning-helper-kit` 이라는 글자가 없으면(이 킷이 만든 게 아니면)
  AskUserQuestion `덮어쓰기`(원본은 `planning/.work/backup/` 에 복사) / `그만두기`.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" export
```

작업용 임시 파일·백업이 있는 `planning/.work/` 는 엔진이 넣어 둔 `planning/.work/.gitignore` 때문에 올라가지 않는다(따로 손대지 않는다).
개발 명세서와 기반 선택이 둘 다 없으면 `CLAUDE.md` 는 만들어지지 않는다 — 엔진 출력 한 줄을 그대로 전한다.

## 2. 이미 연결된 저장소가 있는지

```bash
git rev-parse --show-toplevel 2>/dev/null; git remote get-url origin 2>/dev/null
```

- **이 폴더가 다른 git 저장소 안쪽**이면(최상위 경로가 지금 폴더가 아님) 그 사실을 알리고 AskUserQuestion
  `그 저장소에 함께 올리기` / `그만두기`. 함께 올리면 아래에서 그 저장소 기준으로 진행한다.
- **origin 이 이미 있으면** 새 저장소를 만들지 않는다 → 7절(바뀐 내용 올리기)로 바로 간다.
- 저장소가 없거나 origin 이 없으면 3절.

## 3. GitHub 준비 (설치·로그인 확인)

```bash
gh --version 2>/dev/null | head -1; gh auth status 2>&1 | head -3
```

**`gh` 가 없으면** 아래를 안내하고 멈춘다:

> GitHub 에 올리려면 "GitHub CLI" 라는 작은 프로그램이 한 번 필요해요.
> 1. 설치 — 윈도우는 **새 PowerShell 창**에서 `winget install --id GitHub.cli`, 맥은 터미널에서 `brew install gh`
> 2. 설치가 끝나면 Claude Code 를 껐다 다시 켜 주세요(새로 설치한 프로그램을 알아보게 하려고요).
> 3. 다시 켠 뒤 `/ph:publish` 를 하면 로그인부터 이어서 도와 드릴게요.

**설치는 됐는데 로그인이 안 돼 있으면** 아래를 안내하고 멈춘다(이쪽에서 대화형 로그인을 대신 실행하지 않는다):

> GitHub 로그인이 한 번 필요해요. 이 입력창에 아래를 **그대로** 입력해 직접 실행해 주세요(맨 앞의 `!` 까지):
> `! gh auth login`
> 물어보는 것은 GitHub.com → HTTPS → 예(Y) → 브라우저로 로그인 순으로 고르면 돼요.
> 화면에 나온 코드를 브라우저에 넣고 승인하면 끝이에요. 그다음 다시 `/ph:publish`

로그인돼 있으면 4절.

## 4. 어디에, 어떻게 올릴지

```bash
gh api user -q .login; gh api user/orgs -q '.[].login'
```

AskUserQuestion 한 번에 세 질문:
1. header `만들 위치`, question "어느 계정에 만들까요?" — 내 계정을 첫째로, 조직은 최대 3개 + 기타(조직 이름 입력).
2. header `공개 범위`, question "누가 볼 수 있게 할까요?"
   - `비공개 (권장)` — 나와 초대한 사람만
   - `공개` — 인터넷의 누구나 볼 수 있음
3. header `저장소 이름` — 프로젝트명을 영문 소문자·숫자·`-` 로 바꾼 이름 1~2개를 제안 + 기타(직접 입력).
   한글뿐이면 `planning-<yyyymmdd>` 를 제안한다.

`공개` 를 골랐으면 한 번 더 확인한다 — AskUserQuestion header `공개 확인`,
question "공개로 하면 기획 문서 전체를 누구나 볼 수 있어요. 정말 공개로 할까요?" `비공개로 바꾸기`(권장) / `공개로 올리기`.

## 5. 첫 저장 (새 저장소일 때)

```bash
[ -d .git ] || git init -b main 2>/dev/null || { git init && git checkout -b main; }
git config core.quotepath false
git config user.name >/dev/null || echo "need user.name"; git config user.email >/dev/null || echo "need user.email"
git status --short
```

- 이름·메일이 없으면 GitHub 계정 정보로 이 저장소에만 설정한다(`--global` 쓰지 않음):
  ```bash
  mkdir -p planning/.work; gh api user > planning/.work/gh-user.json
  node -e 'const u=JSON.parse(require("fs").readFileSync("planning/.work/gh-user.json","utf8"));console.log(u.name||u.login);console.log(u.email||`${u.id}+${u.login}@users.noreply.github.com`)'
  ```
  첫 줄을 `git config user.name "<이름>"`, 둘째 줄을 `git config user.email "<메일>"` 로 넣는다.
- `git status --short` 에 `README.md` `CLAUDE.md` `.gitignore` `docs/` `planning/` 말고 다른 파일이 있으면 목록을 보여 주고
  AskUserQuestion `기획 문서만 올리기`(권장) / `폴더 전체 올리기`.
- 올라가는 것: `README.md`, `CLAUDE.md`, `docs/*.md`, `planning/project.json`, `planning/input/*` (나중에 이어서 고칠 수 있게).
  `planning/.work/` 는 빠진다.

커밋 메시지는 Write 로 `planning/.work/commit-msg.txt` 에 UTF-8 로 쓴다(예: `docs: <프로젝트명> 기획 문서 (planning-helper-kit)` + 포함 문서 목록).

```bash
git add -- $(ls -d README.md CLAUDE.md .gitignore docs planning 2>/dev/null)   # 폴더 전체면 git add -A
git commit -F planning/.work/commit-msg.txt
```

## 6. 저장소 만들고 올리기

```bash
gh repo create "<만들 위치>/<저장소 이름>" --private --source . --remote origin --push --description "<한 줄 요약>"
```

- 4절에서 공개를 두 번 확인받은 경우에만 `--private` 대신 `--public`.
- 이름이 이미 있다는 오류("already exists")면 다른 이름을 받아 다시 만든다. 그 밖의 오류는 쉬운 말로 알린다.
- 조직에 만들 권한이 없다는 오류면 그렇게 알리고 내 계정에 만들지 묻는다.

## 7. 바뀐 내용 올리기 (이미 연결된 저장소)

```bash
git remote get-url origin
git add -- $(ls -d README.md CLAUDE.md .gitignore docs planning 2>/dev/null)
git status --short
```

- 바뀐 게 없으면 "이미 최신이에요" 하고 저장소 주소만 보여 준다.
- 커밋 메시지를 `planning/.work/commit-msg.txt` 에 쓰고(`docs: 기획 문서 갱신` + 바뀐 문서 목록) `git commit -F planning/.work/commit-msg.txt`.
- 올리기: `git push`. 인증 오류가 나면 `gh auth status` 로 로그인을 확인하고(안 돼 있으면 3절의 로그인 안내),
  로그인돼 있으면 `gh auth setup-git` 후 다시 `git push`.
- 원격에 내 쪽에 없는 변경이 있어 거절되면(누가 GitHub 에서 직접 고침) 강제로 덮어쓰지 않는다.
  상황을 알리고 `git pull --rebase` 를 해도 되는지 AskUserQuestion 으로 묻는다.

## 8. 결과

```
저장소에 올렸습니다 — <저장소 주소>
- 공개 범위: 비공개 / 공개
- 올린 문서: README.md, CLAUDE.md, docs/PRD.md ... (<N>개)
개발 담당자에게 이 주소를 전하면 CLAUDE.md 를 읽고 바로 구현을 시작할 수 있어요.
문서를 고친 뒤 다시 /ph:publish 하면 바뀐 내용만 올라갑니다.
```

저장소 주소와 공개 범위: `gh repo view --json url,visibility -q '.url + " " + .visibility'`.
