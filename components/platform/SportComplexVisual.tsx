import type { HomeSportVisual } from "@/lib/platform/homeHeroTheme";

type Props = {
  activeSport: HomeSportVisual;
  isNight: boolean;
};

export function SportComplexVisual({ activeSport, isNight }: Props) {
  return (
    <div
      className={`platform-sport-complex${isNight ? " is-night" : " is-day"}`}
      data-active-sport={activeSport}
      role="img"
      aria-label={`Complejo multicancha de Caxas SportCenter en modo ${isNight ? "noche con reflectores" : "día"}`}
    >
      <div className="platform-sport-complex__sky" aria-hidden="true" />
      <div className="platform-sport-complex__roof" aria-hidden="true"><span>COLISEO</span></div>
      <div className="platform-sport-complex__court platform-sport-complex__court--football" data-court="football" aria-hidden="true"><i /><b /></div>
      <div className="platform-sport-complex__court platform-sport-complex__court--volleyball" data-court="volleyball" aria-hidden="true"><i /><b /></div>
      <div className="platform-sport-complex__court platform-sport-complex__court--basketball" data-court="basketball" aria-hidden="true"><i /><b /></div>
      <div className="platform-sport-complex__court platform-sport-complex__court--futsal" data-court="futsal" aria-hidden="true"><i /><b /></div>
      <div className="platform-sport-complex__lights" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <div className="platform-sport-complex__legend" aria-hidden="true">
        <span>Fútbol</span><span>Vóley</span><span>Básquet</span><span>Futsal</span>
      </div>
    </div>
  );
}

