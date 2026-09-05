/*
 * 기능(B) — 페이지 드래그 차단.
 *
 * css/base.css가 선택·이미지 드래그를 이미 끄지만 -webkit-user-drag는
 * 크로미움·사파리 전용이라, 그 밖의 브라우저에서는 이미지와 링크가 그대로
 * 끌린다. 화면 전체가 게임이므로 드래그 시작 자체를 여기서 막는다.
 * (입력 칸 안에서 글자를 끄는 건 그대로 둔다 — QA 패널에서 값을 고쳐야 한다.)
 */
document.addEventListener("dragstart", event => {
  if (event.target.closest?.("input, textarea")) return;
  event.preventDefault();
});
