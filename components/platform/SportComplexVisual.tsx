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
      role="img"
      aria-label={`${theme.sceneLabel} de Caxas SportCenter en modo ${isNight ? "noche con reflectores" : "día"}`}
    >
      <div className="platform-sport-diorama__ambient" aria-hidden="true" />
      <div className="platform-sport-diorama__scene" aria-hidden="true">
        <div className="platform-sport-diorama__building"><span>SPORT</span><i /><i /><i /></div>
        <div className="platform-sport-diorama__stand"><i /><i /><i /><i /></div>
        <div className="platform-sport-diorama__base">
          <div className="platform-sport-diorama__court">
            <span className="platform-sport-diorama__center-line" />
            <span className="platform-sport-diorama__center-circle" />
            <span className="platform-sport-diorama__key platform-sport-diorama__key--a" />
            <span className="platform-sport-diorama__key platform-sport-diorama__key--b" />
          </div>
          <span className="platform-sport-diorama__goal platform-sport-diorama__goal--a"><i /></span>
          <span className="platform-sport-diorama__goal platform-sport-diorama__goal--b"><i /></span>
          <span className="platform-sport-diorama__net"><i /></span>
          <span className="platform-sport-diorama__hoop platform-sport-diorama__hoop--a"><i /></span>
          <span className="platform-sport-diorama__hoop platform-sport-diorama__hoop--b"><i /></span>
          <div className="platform-sport-diorama__fence"><i /><i /><i /><i /></div>
          <div className="platform-sport-diorama__multi-grid">
            <span className="platform-sport-diorama__mini platform-sport-diorama__mini--football" />
            <span className="platform-sport-diorama__mini platform-sport-diorama__mini--volleyball" />
            <span className="platform-sport-diorama__mini platform-sport-diorama__mini--basketball" />
            <span className="platform-sport-diorama__mini platform-sport-diorama__mini--indoor" />
          </div>
        </div>
      </div>
      <div className="platform-sport-diorama__lights" aria-hidden="true">
        <span><i /></span><span><i /></span><span><i /></span><span><i /></span>
      </div>
      <div className="platform-sport-diorama__caption" aria-hidden="true">
        <span><Icon name={theme.icon} size={14} /> {theme.label}</span>
        <small>Instalación deportiva · Cajamarca</small>
      </div>
    </div>
  );
}

