import {Component,type ReactNode} from 'react';

// A failed lazy chunk after a Pages deployment should not blank the whole private workspace.
export class PageBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError() {return {failed:true}}
  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="panel form-panel" role="alert"><h2>Não foi possível abrir esta página</h2>
      <p className="modal-intro">Confira a conexão e recarregue o e-Leão para tentar novamente. Você também pode abrir outra ferramenta pelo menu.</p>
      <button className="btn" onClick={()=>location.reload()}>Recarregar e-Leão</button></section>;
  }
}
