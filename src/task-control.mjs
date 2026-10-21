// Own only the existing local extraction queues; never create a second executor.
export class TaskControl {
  constructor({analyzer,layers,reviewControl,provider,journal}) {
    Object.assign(this,{analyzer,layers,reviewControl,provider,journal});
  }
  status() {
    const available=!!this.analyzer,requested=!!this.analyzer?.state.tasksPaused;
    const active=(this.analyzer?.active.size||0)+(this.layers?.active.size||0);
    const externalActive=!!this.reviewControl?.worker();
    const phase=!available?'unavailable':requested?(active||externalActive?'pausing':'paused'):this.analyzer.state.enabled?'enabled':'stopped';
    return {available,phase,active,externalActive,canStart:available&&!active&&!externalActive&&phase!=='enabled',canPause:available&&phase!=='paused'&&phase!=='pausing',provider:this.provider,
      checkpointsPreserved:true,externalControlRequired:requested&&externalActive};
  }
  control({action}) {
    if(!['start','pause'].includes(action))throw Object.assign(Error('任务控制操作无效'),{status:400});
    if(!this.analyzer)throw Object.assign(Error('任务控制将在后台下次正常启动后可用'),{status:503});
    const before=this.status();
    if(action==='start') {
      if(before.phase==='pausing'||before.externalActive||(before.active&&before.phase!=='enabled'))throw Object.assign(Error('任务仍在退出，请等待暂停完成后继续'),{status:409});
      if(before.phase==='enabled')return {accepted:false,unchanged:true,...before};
      this.analyzer.state.tasksPaused=false;
      this.layers?.resumeGlobal();
      this.analyzer.configure({enabled:true});
    } else {
      this.onPause?.();
      this.analyzer.state.tasksPaused=true;
      this.analyzer.configure({enabled:false});
      this.layers?.pauseGlobal();
    }
    const status=this.status();
    this.journal?.append({kind:'operation',action:action==='start'?'TASKS_RESUME_REQUESTED':'TASKS_PAUSE_REQUESTED',status:status.phase==='paused'?'paused':'accepted'});
    return {accepted:true,...status};
  }
}
