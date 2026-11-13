// 게임 썸네일. 이미지 파일 대신 CSS로 그린다. (cover 키별로 styles.css에 정의)
export function Cover({ kind }: { kind: string }) {
  return (
    <div className={`cover cover-${kind}`} aria-hidden>
      <i className="orb a" />
      <i className="orb b" />
      <i className="orb c" />
    </div>
  );
}
