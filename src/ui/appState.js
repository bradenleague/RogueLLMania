class AppState {
  constructor() {
    this.state = 'START';
    this.listeners = [];
    this.data = {};
  }

  setState(newState, data = {}) {
    const oldState = this.state;
    this.state = newState;
    this.data = { ...this.data, ...data };

    this.listeners.forEach(callback => {
      callback(newState, oldState, this.data);
    });
  }

  getState() {
    return this.state;
  }

  getData() {
    return { ...this.data };
  }

  onStateChange(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
}

const appState = new AppState();

export { appState };
