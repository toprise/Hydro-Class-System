import { Intent, Position, Toaster } from '@blueprintjs/core';
import $ from 'jquery';
import { tpl, zIndexManager } from 'vj/utils/base';

const ToasterContainer = document.createElement('div');
ToasterContainer.style.position = 'fixed';
ToasterContainer.style.bottom = '0px';
ToasterContainer.style.zIndex = '9999';
document.body.append(ToasterContainer);

export const AppToaster = Toaster.create({
  className: 'recipe-toaster',
  position: Position.LEFT_BOTTOM,
  usePortal: true,
} as any, ToasterContainer);

interface NotificationOptions {
  avatar?: string;
  title?: string;
  message: string;
  type?: string;
  duration?: number;
  action?: any;
}

export default class Notification {
  type: string;
  action: any;
  $dom: JQuery<HTMLElement>;
  $n: JQuery<HTMLElement>;
  duration: number;
  autoHideTimer?: NodeJS.Timeout;

  constructor({
    avatar, title, message, type = '', duration = 3000, action,
  }: NotificationOptions) {
    this.type = type;
    if (avatar) this.type += ' avatar';
    if (title) this.type += ' title';
    this.action = action || (() => { });
    this.$dom = $(tpl`<div class="notification ${type} hide"></div>`);
    if (avatar) $(tpl`<img width="64" height="64" class="avatar" src="${avatar}"></img>`).appendTo(this.$dom);
    if (title) {
      $(tpl`<div class="notification-content"><h2>${title}</h2><p>${message}</p></div>`).appendTo(this.$dom);
    } else $(tpl`<p>${message}</p>`).appendTo(this.$dom);
    this.$dom.on('click', this.handleClick.bind(this));
    this.$n = this.$dom
      .css('z-index', zIndexManager.getNext())
      .appendTo(document.body);
    this.$n.width(); // force reflow
    this.duration = duration;
  }

  handleClick() {
    this.action();
  }

  show(autohide = true) {
    this.$n.removeClass('hide');
    if (this.duration && autohide) this.autoHideTimer = setTimeout(this.hide.bind(this), this.duration);
  }

  hide() {
    this.$n.addClass('hide');
    setTimeout(() => this.$n.remove(), 200);
  }

  static success(message: string, duration?: number) {
    return AppToaster.show({ message, timeout: duration, intent: Intent.SUCCESS });
  }

  static info(message: string, duration?: number) {
    return AppToaster.show({ message, timeout: duration, intent: Intent.PRIMARY });
  }

  static warn(message: string, duration?: number) {
    return AppToaster.show({ message, timeout: duration, intent: Intent.WARNING });
  }

  static error(message: string, duration?: number) {
    return AppToaster.show({ message, timeout: duration, intent: Intent.DANGER });
  }
}

window.Hydro.components.Notification = Notification;
