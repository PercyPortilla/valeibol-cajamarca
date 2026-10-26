import type { HomeSportTheme } from "@/lib/platform/homeHeroTheme";
import { Icon } from "@/components/ui/Icon";

type Props = {
  theme: HomeSportTheme;
  isNight: boolean;
};

export function SportComplexVisual({ theme, isNight }: Props) {
  return (
    <div
      className={`platform-sport-diorama${isNight ? " is-night" : " is-day"}`}
      data-active-sport={theme.visual}
      data-scene={theme.visual}
      data-camera-focus={theme.visual}
      role="img"
      aria-label={`Complejo deportivo multicancha de Caxas SportCenter, enfoque en ${theme.sceneLabel}, modo ${isNight ? "noche con reflectores" : "día"}`}
    >
      <div className="platform-sport-diorama__ambient" aria-hidden="true" />
      <div className="platform-sport-diorama__skyline" aria-hidden="true">
        <span className="platform-sport-diorama__mountain platform-sport-diorama__mountain--a" />
        <span className="platform-sport-diorama__mountain platform-sport-diorama__mountain--b" />
        <span className="platform-sport-diorama__city-glow" />
        <span className="platform-sport-diorama__city-lights"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></span>
      </div>
      <div className="platform-sport-diorama__scene" aria-hidden="true">
        <div className="platform-sport-diorama__camera">
          <div className="platform-sport-diorama__world">
            <span className="platform-sport-diorama__ground" />
            <span className="platform-sport-diorama__road platform-sport-diorama__road--a" />
            <span className="platform-sport-diorama__road platform-sport-diorama__road--b" />

            <div className="platform-sport-diorama__building platform-sport-diorama__building--north"><span>CAXAS SPORT</span><i /><i /><i /><i /><i /></div>
            <div className="platform-sport-diorama__building platform-sport-diorama__building--east"><span>CLUB</span><i /><i /><i /></div>

            <div className="platform-sport-diorama__court-zone platform-sport-diorama__court-zone--football" data-sport="football">
              <span className="platform-sport-diorama__fence" />
              <div className="platform-sport-diorama__court platform-sport-diorama__court--football">
                <span className="platform-sport-diorama__center-line" />
                <span className="platform-sport-diorama__center-circle" />
                <span className="platform-sport-diorama__penalty platform-sport-diorama__penalty--a" />
                <span className="platform-sport-diorama__penalty platform-sport-diorama__penalty--b" />
              </div>
              <span className="platform-sport-diorama__goal platform-sport-diorama__goal--a"><i /></span>
              <span className="platform-sport-diorama__goal platform-sport-diorama__goal--b"><i /></span>
              <span className="platform-sport-diorama__court-label">Fútbol</span>
            </div>

            <div className="platform-sport-diorama__court-zone platform-sport-diorama__court-zone--volleyball" data-sport="volleyball">
              <span className="platform-sport-diorama__fence" />
              <div className="platform-sport-diorama__court platform-sport-diorama__court--volleyball">
                <span className="platform-sport-diorama__center-line" />
              </div>
              <span className="platform-sport-diorama__net"><i /></span>
              <span className="platform-sport-diorama__court-label">Vóley</span>
            </div>

            <div className="platform-sport-diorama__court-zone platform-sport-diorama__court-zone--basketball" data-sport="basketball">
              <span className="platform-sport-diorama__fence" />
              <div className="platform-sport-diorama__court platform-sport-diorama__court--basketball">
                <span className="platform-sport-diorama__center-line" />
                <span className="platform-sport-diorama__center-circle" />
                <span className="platform-sport-diorama__key platform-sport-diorama__key--a" />
                <span className="platform-sport-diorama__key platform-sport-diorama__key--b" />
              </div>
              <span className="platform-sport-diorama__hoop platform-sport-diorama__hoop--a"><i /></span>
              <span className="platform-sport-diorama__hoop platform-sport-diorama__hoop--b"><i /></span>
              <span className="platform-sport-diorama__court-label">Básquet</span>
            </div>

            <div className="platform-sport-diorama__court-zone platform-sport-diorama__court-zone--futsal" data-sport="futsal">
              <span className="platform-sport-diorama__fence" />
              <div className="platform-sport-diorama__court platform-sport-diorama__court--futsal">
                <span className="platform-sport-diorama__center-line" />
                <span className="platform-sport-diorama__center-circle" />
              </div>
              <span className="platform-sport-diorama__goal platform-sport-diorama__goal--a"><i /></span>
              <span className="platform-sport-diorama__goal platform-sport-diorama__goal--b"><i /></span>
              <span className="platform-sport-diorama__court-label">Futsal</span>
            </div>

            <div className="platform-sport-diorama__stand platform-sport-diorama__stand--west"><i /><i /><i /><i /></div>
            <div className="platform-sport-diorama__stand platform-sport-diorama__stand--south"><i /><i /><i /><i /><i /></div>
          </div>
        </div>
      </div>
      <div className="platform-sport-diorama__lights" aria-hidden="true">
        <span><i /></span><span><i /></span><span><i /></span><span><i /></span><span><i /></span><span><i /></span><span><i /></span><span><i /></span>
      </div>
      <div className="platform-sport-diorama__caption" aria-hidden="true">
        <span><Icon name={theme.icon} size={14} /> {theme.label}</span>
        <small>{isNight ? "Reflectores activos · hora real de Cajamarca" : "Reflectores automáticos desde las 18:00"}</small>
      </div>
    </div>
  );
}

